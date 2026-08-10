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
    const organizationId = this.resolveOrganizationId(user, dto.organizationId);

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
    const logCount = await this.prisma.attendanceLog.count({
      where: {
        deviceId: device.id,
      },
    });

    if (logCount > 0) {
      return {
        removed: false,
        deactivated: true,
        device: await this.prisma.zktecoDevice.update({
          where: {
            id: device.id,
          },
          data: {
            status: DeviceStatus.INACTIVE,
          },
        }),
      };
    }

    await this.prisma.zktecoDevice.delete({
      where: {
        id: device.id,
      },
    });

    return {
      removed: true,
      deactivated: false,
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

  private resolveOrganizationId(user: CurrentUser, organizationId?: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!organizationId) {
        throw new BadRequestException(
          'organizationId is required for SUPER_ADMIN device creation',
        );
      }

      return organizationId;
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
