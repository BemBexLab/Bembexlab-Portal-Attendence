import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

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

  constructor() {}

  async handleConnection(client: Socket) {
    await client.join('super-admins');
    client.emit('connected', { socketId: client.id });
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

  private getOrganizationRoom(organizationId: string) {
    return `organization:${organizationId}`;
  }

}
