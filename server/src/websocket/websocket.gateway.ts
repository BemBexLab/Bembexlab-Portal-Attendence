import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';

import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import {
  AttendanceUpdatedPayload,
  DeviceConnectionPayload,
  REALTIME_EVENTS,
} from './types/realtime-events.type';

@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      if (user.role === UserRole.SUPER_ADMIN) {
        await client.join('super-admins');
      }

      if (user.organizationId) {
        await client.join(this.getOrganizationRoom(user.organizationId));
      }

      client.emit('connected', { socketId: client.id });
    } catch (error) {
      this.logger.warn(
        `Socket connection rejected: ${this.getErrorMessage(error)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    return;
  }

  emitAttendanceUpdated(payload: AttendanceUpdatedPayload) {
    this.emitToOrganization(
      payload.organizationId,
      REALTIME_EVENTS.ATTENDANCE_UPDATED,
      payload,
    );
  }

  emitDeviceConnected(payload: DeviceConnectionPayload) {
    this.emitToOrganization(
      payload.organizationId,
      REALTIME_EVENTS.DEVICE_CONNECTED,
      payload,
    );
  }

  emitDeviceDisconnected(payload: DeviceConnectionPayload) {
    this.emitToOrganization(
      payload.organizationId,
      REALTIME_EVENTS.DEVICE_DISCONNECTED,
      payload,
    );
  }

  private emitToOrganization<TPayload>(
    organizationId: string,
    event: string,
    payload: TPayload,
  ) {
    this.server
      .to(this.getOrganizationRoom(organizationId))
      .to('super-admins')
      .emit(event, payload);
  }

  private extractToken(client: Socket) {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }

    const cookieHeader = client.handshake.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const tokenCookie = cookies.find((cookie) =>
      cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`),
    );

    return tokenCookie
      ? decodeURIComponent(tokenCookie.split('=').slice(1).join('='))
      : null;
  }

  private getOrganizationRoom(organizationId: string) {
    return `organization:${organizationId}`;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
