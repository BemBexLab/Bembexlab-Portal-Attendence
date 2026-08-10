import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationType } from '@prisma/client';
import ZKLib from 'node-zklib';

import {
  NormalizedAttendancePunch,
  NormalizedZktecoUser,
  ZktecoConnectionTarget,
  ZktecoDeviceInfo,
  ZktecoRawAttendanceRecord,
  ZktecoRawUser,
} from './types/zkteco.types';

type ZktecoProtocol = 'auto' | 'tcp' | 'udp';
type ConnectedTransport = {
  client: ZKLib;
  protocol: Exclude<ZktecoProtocol, 'auto'>;
};

@Injectable()
export class ZKTecoService {
  private readonly logger = new Logger(ZKTecoService.name);
  private readonly timeoutMs: number;
  private readonly localPort: number;
  private readonly protocol: ZktecoProtocol;
  private readonly timeOffsetMinutes: number;
  private readonly deviceUtcOffsetMinutes: number;

  constructor(configService: ConfigService) {
    this.timeoutMs = configService.get<number>('ZKTECO_TIMEOUT_MS') ?? 10_000;
    this.localPort = configService.get<number>('ZKTECO_LOCAL_PORT') ?? 0;
    this.protocol = this.normalizeProtocol(
      configService.get<string>('ZKTECO_PROTOCOL'),
    );
    this.timeOffsetMinutes = Number(
      configService.get<string>('ZKTECO_TIME_OFFSET_MINUTES') ?? 0,
    );
    this.deviceUtcOffsetMinutes = Number(
      configService.get<string>('ZKTECO_DEVICE_UTC_OFFSET_MINUTES') ?? 0,
    );
  }

  async testConnection(target: ZktecoConnectionTarget) {
    const startedAt = Date.now();

    await this.withConnection(target, () => undefined);

    return {
      online: true,
      latencyMs: Date.now() - startedAt,
    };
  }

  async getDeviceInfo(
    target: ZktecoConnectionTarget,
  ): Promise<ZktecoDeviceInfo> {
    return this.withConnection(target, async (client) => {
      const info = await client.getInfo();
      return info;
    });
  }

  async getAttendancePunches(target: ZktecoConnectionTarget) {
    return this.withConnection(target, async (client) => {
      const response = await client.getAttendances();

      if (response.err) {
        throw response.err;
      }

      return response.data
        .map((record) =>
          this.normalizeAttendanceRecord(record as ZktecoRawAttendanceRecord),
        )
        .filter((record): record is NormalizedAttendancePunch =>
          Boolean(record),
        );
    });
  }

  async getUsers(target: ZktecoConnectionTarget) {
    return this.withConnection(target, async (client) => {
      const response = await client.getUsers();

      if (response.err) {
        throw response.err;
      }

      return response.data
        .map((user) => this.normalizeUser(user as ZktecoRawUser))
        .filter((user): user is NormalizedZktecoUser => Boolean(user));
    });
  }

  private async withConnection<TResult>(
    target: ZktecoConnectionTarget,
    callback: (client: ZKLib) => TResult | Promise<TResult>,
  ) {
    let connected: ConnectedTransport | null = null;

    try {
      connected = await this.connect(target);
      this.logger.log(
        `ZKTeco connected to ${target.ip}:${target.port} using ${connected.protocol.toUpperCase()}`,
      );
      return await callback(connected.client);
    } catch (error) {
      const details = this.getErrorMessage(error);
      this.logger.warn(
        `ZKTeco connection failed for ${target.ip}:${target.port}: ${details}`,
      );

      throw new ServiceUnavailableException(
        `Unable to communicate with ZKTeco device at ${target.ip}:${target.port}. ${details}`,
      );
    } finally {
      try {
        await connected?.client.disconnect();
      } catch (error) {
        this.logger.debug(
          `ZKTeco disconnect ignored for ${target.ip}:${target.port}: ${this.getErrorMessage(error)}`,
        );
      }
    }
  }

  private async connect(target: ZktecoConnectionTarget) {
    const errors: string[] = [];

    if (this.protocol === 'tcp' || this.protocol === 'auto') {
      try {
        return await this.connectWithProtocol(target, 'tcp');
      } catch (error) {
        errors.push(`TCP: ${this.getErrorMessage(error)}`);
      }
    }

    if (this.protocol === 'udp' || this.protocol === 'auto') {
      try {
        return await this.connectWithProtocol(target, 'udp');
      } catch (error) {
        errors.push(`UDP: ${this.getErrorMessage(error)}`);
      }
    }

    throw new Error(errors.join(' | ') || 'No ZKTeco protocol attempted');
  }

  private async connectWithProtocol(
    target: ZktecoConnectionTarget,
    protocol: Exclude<ZktecoProtocol, 'auto'>,
  ): Promise<ConnectedTransport> {
    const client = new ZKLib(
      target.ip,
      target.port,
      this.timeoutMs,
      this.localPort,
    );
    const transport = protocol === 'tcp' ? client.zklibTcp : client.zklibUdp;

    try {
      await this.withTimeout(async () => {
        await transport.createSocket();
        await transport.connect();
      }, `${protocol.toUpperCase()} connection timed out`);

      client.connectionType = protocol;
      return {
        client,
        protocol,
      };
    } catch (error) {
      try {
        await transport.disconnect();
      } catch {
        // Ignore cleanup failures after unsuccessful socket attempts.
      }
      this.forceCloseTransport(transport);

      throw error;
    }
  }

  private forceCloseTransport(transport: ZKLib['zklibTcp']) {
    try {
      transport.socket?.removeAllListeners?.();
      transport.socket?.destroy?.();
      transport.socket?.close?.();
    } catch {
      // Best-effort cleanup for sockets left half-open by the device library.
    }
  }

  private withTimeout<TResult>(
    operation: () => Promise<TResult>,
    timeoutMessage: string,
  ) {
    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, this.timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  private normalizeProtocol(protocol?: string): ZktecoProtocol {
    if (protocol === 'tcp' || protocol === 'udp' || protocol === 'auto') {
      return protocol;
    }

    return 'auto';
  }

  private normalizeAttendanceRecord(
    record: ZktecoRawAttendanceRecord,
  ): NormalizedAttendancePunch | null {
    const deviceUserId =
      typeof record.deviceUserId === 'string' ||
      typeof record.deviceUserId === 'number'
        ? String(record.deviceUserId).trim()
        : '';
    const rawPunchTime =
      record.recordTime instanceof Date
        ? record.recordTime
        : new Date(String(record.recordTime));

    if (!deviceUserId || Number.isNaN(rawPunchTime.getTime())) {
      return null;
    }

    // node-zklib constructs the device's timezone-less wall clock with
    // `new Date(year, ...)`, which incorrectly assigns the API host timezone.
    // Rebuild that wall clock as the configured device timezone before storing
    // the real UTC instant in PostgreSQL.
    const deviceWallClockAsUtc = Date.UTC(
      rawPunchTime.getFullYear(),
      rawPunchTime.getMonth(),
      rawPunchTime.getDate(),
      rawPunchTime.getHours(),
      rawPunchTime.getMinutes(),
      rawPunchTime.getSeconds(),
    );
    const punchTime = new Date(
      deviceWallClockAsUtc -
        this.deviceUtcOffsetMinutes * 60_000 +
        this.timeOffsetMinutes * 60_000,
    );

    return {
      deviceUserId,
      punchTime,
      verificationType: VerificationType.UNKNOWN,
      raw: record,
    };
  }

  private normalizeUser(user: ZktecoRawUser): NormalizedZktecoUser | null {
    const deviceUserId =
      typeof user.userId === 'string' || typeof user.userId === 'number'
        ? String(user.userId).trim()
        : '';

    if (!deviceUserId) {
      return null;
    }

    const name = typeof user.name === 'string' ? user.name.trim() : '';

    return {
      deviceUserId,
      name: name || null,
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
