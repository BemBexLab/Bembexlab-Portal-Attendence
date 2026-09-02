import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceStatus, UserRole } from '@prisma/client';

import { CurrentUser } from '../auth/types/current-user.type';
import { AttendanceProcessingService } from '../attendance/attendance-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZKTecoService } from '../zkteco/zkteco.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { HistoricalAttendanceQueryDto } from './dto/historical-attendance-query.dto';
import { TestDeviceDto } from './dto/test-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceSyncResult } from './types/device-sync-result.type';

@Injectable()
export class DevicesService {
  constructor(
    private readonly attendanceProcessingService: AttendanceProcessingService,
    private readonly prisma: PrismaService,
    private readonly zktecoService: ZKTecoService,
  ) {}

  listDevices(user: CurrentUser) {
    return this.prisma.zktecoDevice.findMany({
      where: this.createTenantFilter(user),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async addDevice(user: CurrentUser, dto: CreateDeviceDto) {
    const organizationId = await this.resolveOrganizationId(user, dto.organizationId);

    // Removing a device with attendance history intentionally leaves an
    // INACTIVE row behind. Adding the same endpoint again should restore that
    // device instead of producing a misleading duplicate error.
    const existing = await this.prisma.zktecoDevice.findFirst({
      where: {
        organizationId,
        ip: dto.ip,
        port: dto.port,
      },
    });
    if (existing) {
      if (existing.status === DeviceStatus.INACTIVE) {
        return this.prisma.zktecoDevice.update({
          where: { id: existing.id },
          data: {
            name: dto.name.trim(),
            status: dto.status ?? DeviceStatus.ACTIVE,
          },
        });
      }
      throw new ConflictException(
        'A device with this IP and port already exists for this organization',
      );
    }

    try {
      return await this.prisma.zktecoDevice.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          ip: dto.ip,
          port: dto.port,
          status: dto.status ?? DeviceStatus.ACTIVE,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A device with this IP and port already exists for this organization',
        );
      }

      throw error;
    }
  }

  async updateDevice(user: CurrentUser, id: string, dto: UpdateDeviceDto) {
    await this.getAccessibleDevice(user, id);

    try {
      return await this.prisma.zktecoDevice.update({
        where: {
          id,
        },
        data: {
          name: dto.name?.trim(),
          ip: dto.ip,
          port: dto.port,
          status: dto.status,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A device with this IP and port already exists for this organization',
        );
      }

      throw error;
    }
  }

  async removeDevice(user: CurrentUser, id: string) {
    const device = await this.getAccessibleDevice(user, id);
    const removed = await this.prisma.$transaction(async (tx) => {
      const logCount = await tx.attendanceLog.count({
        where: { deviceId: device.id },
      });
      await tx.zktecoDevice.delete({ where: { id: device.id } });
      return logCount;
    });

    return {
      removed: true,
      deactivated: false,
      preservedLogs: removed,
    };
  }

  testConnection(dto: TestDeviceDto) {
    return this.zktecoService.testConnection(dto);
  }

  async testSavedDeviceConnection(user: CurrentUser, id: string) {
    const device = await this.getAccessibleDevice(user, id);

    try {
      const result = await this.zktecoService.testConnection(device);
      await this.markDeviceStatus(device.id, DeviceStatus.ACTIVE);
      return result;
    } catch (error) {
      await this.markDeviceStatus(device.id, DeviceStatus.OFFLINE);
      throw error;
    }
  }

  async fetchDeviceInfo(user: CurrentUser, id: string) {
    const device = await this.getAccessibleDevice(user, id);

    try {
      const info = await this.zktecoService.getDeviceInfo(device);
      await this.markDeviceStatus(device.id, DeviceStatus.ACTIVE);
      return {
        deviceId: device.id,
        info,
      };
    } catch (error) {
      await this.markDeviceStatus(device.id, DeviceStatus.OFFLINE);
      throw error;
    }
  }

  async syncAttendanceLogs(
    user: CurrentUser,
    id: string,
  ): Promise<DeviceSyncResult> {
    const device = await this.getAccessibleDevice(user, id);

    try {
      const result = await this.attendanceProcessingService.processDevice(
        device.id,
      );

      return {
        fetched: result.fetched,
        stored: result.stored,
        duplicates: result.duplicates,
        unmatched: result.unmatched,
        skipped: 0,
        dailyCalculated: result.dailyCalculated,
      };
    } catch (error) {
      await this.markDeviceStatus(device.id, DeviceStatus.OFFLINE);

      return {
        fetched: 0,
        stored: 0,
        duplicates: 0,
        unmatched: 0,
        skipped: 1,
        dailyCalculated: 0,
        error: this.getErrorMessage(error),
      };
    }
  }

  async getHistoricalAttendance(
    user: CurrentUser,
    id: string,
    query: HistoricalAttendanceQueryDto,
  ) {
    const device = await this.getAccessibleDevice(user, id);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('From date must be before To date');
    }
    const search = query.search?.trim().toLowerCase();

    try {
      const punches = await this.zktecoService.getHistoricalAttendance(device);
      const filtered = punches
        .filter((punch) => !from || punch.punchTime >= from)
        .filter((punch) => !to || punch.punchTime <= to)
        .filter(
          (punch) =>
            !search ||
            punch.deviceUserId.toLowerCase().includes(search) ||
            punch.employeeName?.toLowerCase().includes(search),
        )
        .sort((left, right) => right.punchTime.getTime() - left.punchTime.getTime());

      await this.markDeviceStatus(device.id, DeviceStatus.ACTIVE);
      return {
        source: 'ZKTeco device',
        device: { id: device.id, name: device.name, ip: device.ip, port: device.port },
        fetchedAt: new Date().toISOString(),
        total: filtered.length,
        data: filtered.map((punch) => ({
          deviceUserId: punch.deviceUserId,
          employeeName: punch.employeeName,
          punchTime: punch.punchTime.toISOString(),
          verificationType: punch.verificationType,
          raw: punch.raw,
        })),
      };
    } catch (error) {
      await this.markDeviceStatus(device.id, DeviceStatus.OFFLINE);
      throw error;
    }
  }

  async getAllHistoricalAttendance(
    user: CurrentUser,
    query: HistoricalAttendanceQueryDto,
  ) {
    const devices = await this.prisma.zktecoDevice.findMany({
      where: this.createTenantFilter(user),
      orderBy: { createdAt: 'asc' },
    });
    const data: Array<{
      deviceId: string;
      deviceName: string;
      deviceIp: string;
      devicePort: number;
      deviceUserId: string;
      employeeName: string | null;
      punchTime: string;
      verificationType: string;
      raw: Record<string, unknown>;
    }> = [];
    const errors: Array<{ deviceId: string; deviceName: string; error: string }> = [];

    for (const device of devices) {
      try {
        const result = await this.getHistoricalAttendance(user, device.id, query);
        for (const punch of result.data) {
          data.push({
            deviceId: device.id,
            deviceName: device.name,
            deviceIp: device.ip,
            devicePort: device.port,
            ...punch,
          });
        }
      } catch (error) {
        errors.push({
          deviceId: device.id,
          deviceName: device.name,
          error: this.getErrorMessage(error),
        });
      }
    }

    data.sort(
      (left, right) =>
        new Date(right.punchTime).getTime() - new Date(left.punchTime).getTime(),
    );
    return {
      source: 'ZKTeco devices',
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        ip: device.ip,
        port: device.port,
      })),
      fetchedAt: new Date().toISOString(),
      total: data.length,
      errors,
      data,
    };
  }

  private async getAccessibleDevice(user: CurrentUser, id: string) {
    const device = await this.prisma.zktecoDevice.findFirst({
      where: {
        id,
        ...this.createTenantFilter(user),
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }

  private createTenantFilter(user: CurrentUser) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (!user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    return {
      organizationId: user.organizationId,
    };
  }

  private async resolveOrganizationId(user: CurrentUser, organizationId?: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (organizationId) return organizationId;

      // The login-free isolated environment has one seeded organization.
      // Resolve it automatically for the device CRUD form; require an
      // explicit organization if the deployment later becomes multi-tenant.
      const organizations = await this.prisma.organization.findMany({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 2,
      });
      if (organizations.length === 1) return organizations[0].id;
      if (organizations.length === 0)
        throw new BadRequestException('No organization is configured');
      throw new BadRequestException(
        'organizationId is required when multiple organizations exist',
      );
    }

    if (!user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    if (organizationId && organizationId !== user.organizationId) {
      throw new ForbiddenException(
        'Cannot create devices outside your organization',
      );
    }

    return user.organizationId;
  }

  private markDeviceStatus(id: string, status: DeviceStatus) {
    return this.prisma.zktecoDevice.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
