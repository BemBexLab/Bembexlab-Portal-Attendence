import { Injectable, Logger } from '@nestjs/common';
import { AttendanceStatus, DeviceStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/websocket.gateway';
import { ZKTecoService } from '../zkteco/zkteco.service';
import type { AttendanceUpdatedPayload } from '../websocket/types/realtime-events.type';
import {
  AttendanceProcessingResult,
  ProcessedDeviceResult,
} from './types/attendance-processing.types';
import {
  dateKeyToDatabaseDate,
  getDateKeyInTimeZone,
  getLooseUtcWindowForDateKey,
} from './utils/timezone';

type AffectedAttendanceDay = {
  employeeId: string;
  organizationId: string;
  dateKey: string;
  timezone: string;
};

@Injectable()
export class AttendanceProcessingService {
  private readonly logger = new Logger(AttendanceProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly zktecoService: ZKTecoService,
  ) {}

  async processAllActiveDevices(): Promise<AttendanceProcessingResult> {
    const devices = await this.prisma.zktecoDevice.findMany({
      where: {
        status: {
          in: [DeviceStatus.ACTIVE, DeviceStatus.OFFLINE],
        },
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    const result: AttendanceProcessingResult = {
      processedDevices: 0,
      offlineDevices: 0,
      fetched: 0,
      stored: 0,
      duplicates: 0,
      unmatched: 0,
      dailyCalculated: 0,
      devices: [],
    };

    for (const device of devices) {
      try {
        const deviceResult = await this.processDevice(device.id);
        result.processedDevices += 1;
        result.fetched += deviceResult.fetched;
        result.stored += deviceResult.stored;
        result.duplicates += deviceResult.duplicates;
        result.unmatched += deviceResult.unmatched;
        result.dailyCalculated += deviceResult.dailyCalculated;
        result.devices.push(deviceResult);
      } catch (error) {
        result.offlineDevices += 1;
        this.logger.warn(
          `Attendance sync skipped device ${device.id}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    return result;
  }

  async processDevice(deviceId: string): Promise<ProcessedDeviceResult> {
    const device = await this.prisma.zktecoDevice.findUniqueOrThrow({
      where: {
        id: deviceId,
      },
      include: {
        organization: true,
      },
    });
    const timezone = device.organization.timezone || 'UTC';

    try {
      const punches = await this.zktecoService.getAttendancePunches(device);
      const deviceUserIds = Array.from(
        new Set(punches.map((punch) => punch.deviceUserId)),
      );
      const employees = await this.prisma.employee.findMany({
        where: {
          organizationId: device.organizationId,
          deviceUserId: {
            in: deviceUserIds,
          },
        },
        select: {
          id: true,
          deviceUserId: true,
        },
      });
      const employeeByDeviceUserId = new Map(
        employees
          .filter((employee) => employee.deviceUserId)
          .map((employee) => [employee.deviceUserId as string, employee.id]),
      );
      const affectedDays = new Map<string, AffectedAttendanceDay>();
      const rawLogs = punches.flatMap((punch) => {
        const employeeId = employeeByDeviceUserId.get(punch.deviceUserId);

        if (!employeeId) {
          return [];
        }

        const dateKey = getDateKeyInTimeZone(punch.punchTime, timezone);
        affectedDays.set(`${employeeId}:${dateKey}`, {
          employeeId,
          organizationId: device.organizationId,
          dateKey,
          timezone,
        });

        return {
          organizationId: device.organizationId,
          employeeId,
          deviceId: device.id,
          punchTime: punch.punchTime,
          verificationType: punch.verificationType,
        };
      });
      const createResult =
        rawLogs.length > 0
          ? await this.prisma.attendanceLog.createMany({
              data: rawLogs,
              skipDuplicates: true,
            })
          : { count: 0 };
      let dailyCalculated = 0;
      const dailyAttendance: AttendanceUpdatedPayload['dailyAttendance'] = [];

      for (const affectedDay of affectedDays.values()) {
        const dailyRecord = await this.calculateDailyAttendance(affectedDay);
        dailyAttendance.push({
          employeeId: dailyRecord.employeeId,
          date: dailyRecord.date.toISOString().slice(0, 10),
          firstCheckIn: dailyRecord.firstCheckIn?.toISOString() ?? null,
          lastCheckOut: dailyRecord.lastCheckOut?.toISOString() ?? null,
          workingMinutes: dailyRecord.workingMinutes,
          status: dailyRecord.status,
        });
        dailyCalculated += 1;
      }

      await this.prisma.zktecoDevice.update({
        where: {
          id: device.id,
        },
        data: {
          status: DeviceStatus.ACTIVE,
          lastSync: new Date(),
        },
      });

      this.realtimeGateway.emitDeviceConnected({
        organizationId: device.organizationId,
        deviceId: device.id,
        ip: device.ip,
        port: device.port,
        status: DeviceStatus.ACTIVE,
        emittedAt: new Date().toISOString(),
      });

      if (createResult.count > 0) {
        this.realtimeGateway.emitAttendanceUpdated({
          organizationId: device.organizationId,
          deviceId: device.id,
          fetched: punches.length,
          stored: createResult.count,
          duplicates: rawLogs.length - createResult.count,
          unmatched: punches.length - rawLogs.length,
          dailyCalculated,
          dailyAttendance,
          emittedAt: new Date().toISOString(),
        });
      }

      return {
        deviceId: device.id,
        fetched: punches.length,
        stored: createResult.count,
        duplicates: rawLogs.length - createResult.count,
        unmatched: punches.length - rawLogs.length,
        dailyCalculated,
      };
    } catch (error) {
      await this.prisma.zktecoDevice.update({
        where: {
          id: device.id,
        },
        data: {
          status: DeviceStatus.OFFLINE,
        },
      });

      this.realtimeGateway.emitDeviceDisconnected({
        organizationId: device.organizationId,
        deviceId: device.id,
        ip: device.ip,
        port: device.port,
        status: DeviceStatus.OFFLINE,
        emittedAt: new Date().toISOString(),
      });

      throw error;
    }
  }

  private async calculateDailyAttendance(day: AffectedAttendanceDay) {
    const window = getLooseUtcWindowForDateKey(day.dateKey);
    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        organizationId: day.organizationId,
        employeeId: day.employeeId,
        punchTime: {
          gte: window.start,
          lt: window.end,
        },
      },
      orderBy: {
        punchTime: 'asc',
      },
    });
    const dayLogs = logs.filter(
      (log) =>
        getDateKeyInTimeZone(log.punchTime, day.timezone) === day.dateKey,
    );
    const firstCheckIn = dayLogs[0]?.punchTime ?? null;
    const lastPunch = dayLogs[dayLogs.length - 1]?.punchTime ?? null;
    const lastCheckOut =
      firstCheckIn &&
      lastPunch &&
      lastPunch.getTime() !== firstCheckIn.getTime()
        ? lastPunch
        : null;
    const workingMinutes =
      firstCheckIn && lastCheckOut
        ? Math.max(
            0,
            Math.floor(
              (lastCheckOut.getTime() - firstCheckIn.getTime()) / 60_000,
            ),
          )
        : 0;
    const status = firstCheckIn
      ? lastCheckOut
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.MISSING_CHECKOUT
      : AttendanceStatus.ABSENT;

    return this.prisma.dailyAttendance.upsert({
      where: {
        employeeId_date: {
          employeeId: day.employeeId,
          date: dateKeyToDatabaseDate(day.dateKey),
        },
      },
      update: {
        firstCheckIn,
        lastCheckOut,
        workingMinutes,
        status,
      },
      create: {
        organizationId: day.organizationId,
        employeeId: day.employeeId,
        date: dateKeyToDatabaseDate(day.dateKey),
        firstCheckIn,
        lastCheckOut,
        workingMinutes,
        status,
      },
    });
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
