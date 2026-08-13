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
  zonedDateTimeToUtc,
} from './utils/timezone';

type AffectedAttendanceDay = {
  employeeId: string;
  organizationId: string;
  dateKey: string;
  timezone: string;
};

const GRACE_MINUTES = 15;
const PUNCH_WINDOW_MINUTES = 4 * 60;

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

    await this.enforceTwoMonthRetention();

    return result;
  }

  async enforceTwoMonthRetention() {
    const now = await this.prisma.databaseNow();
    const { retainedDateKey, dailyCutoff, punchCutoff } =
      this.getRetentionCutoffs(now);

    const [dailyAttendance, attendanceLogs] = await this.prisma.$transaction([
      this.prisma.dailyAttendance.deleteMany({
        where: { date: { lt: dailyCutoff } },
      }),
      this.prisma.attendanceLog.deleteMany({
        where: { punchTime: { lt: punchCutoff } },
      }),
    ]);

    if (dailyAttendance.count > 0 || attendanceLogs.count > 0) {
      this.logger.log(
        `Attendance retention removed ${dailyAttendance.count} daily rows and ${attendanceLogs.count} raw punches older than ${retainedDateKey}`,
      );
    }

    return {
      retainedFrom: retainedDateKey,
      dailyAttendanceDeleted: dailyAttendance.count,
      attendanceLogsDeleted: attendanceLogs.count,
    };
  }

  async rebuildDailyAttendanceFromStoredPunches() {
    const databaseNow = await this.prisma.databaseNow();
    const logs = await this.prisma.attendanceLog.findMany({
      where: { employee: { isActive: true } },
      select: {
        employeeId: true,
        organizationId: true,
        punchTime: true,
        organization: { select: { timezone: true } },
        employee: {
          select: {
            shiftAssignments: {
              include: { shift: true },
              orderBy: { effectiveFrom: 'desc' },
            },
          },
        },
      },
      orderBy: { punchTime: 'asc' },
    });
    const affectedDays = new Map<string, AffectedAttendanceDay>();

    for (const log of logs) {
      const timezone = log.organization.timezone || 'Asia/Karachi';
      const dateKey = this.resolveShiftDateKey(
        log.punchTime,
        timezone,
        log.employee.shiftAssignments,
      );
      if (!dateKey) continue;
      affectedDays.set(`${log.employeeId}:${dateKey}`, {
        employeeId: log.employeeId,
        organizationId: log.organizationId,
        dateKey,
        timezone,
      });
    }

    const days = [...affectedDays.values()];
    const batchSize = 20;

    for (let index = 0; index < days.length; index += batchSize) {
      await Promise.all(
        days
          .slice(index, index + batchSize)
          .map((day) => this.calculateDailyAttendance(day, databaseNow)),
      );
    }

    return { recalculated: days.length };
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
    const databaseNow = await this.prisma.databaseNow();

    try {
      const deviceUsers = await this.zktecoService.getUsers(device);
      const existingEmployees = await this.prisma.employee.findMany({
        where: {
          organizationId: device.organizationId,
          deviceUserId: { in: deviceUsers.map((user) => user.deviceUserId) },
        },
        select: { id: true, deviceUserId: true, name: true },
      });
      const existingEmployeeByDeviceUserId = new Map(
        existingEmployees.map((employee) => [employee.deviceUserId, employee]),
      );
      const missingUsers = deviceUsers.filter(
        (user) => !existingEmployeeByDeviceUserId.has(user.deviceUserId),
      );

      if (missingUsers.length > 0) {
        await this.prisma.employee.createMany({
          data: missingUsers.map((deviceUser) => ({
            organizationId: device.organizationId,
            employeeCode: `ZKT-${deviceUser.deviceUserId}`,
            deviceUserId: deviceUser.deviceUserId,
            name: deviceUser.name ?? `K40 User ${deviceUser.deviceUserId}`,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      await Promise.all(
        deviceUsers.flatMap((deviceUser) => {
          const existing = existingEmployeeByDeviceUserId.get(
            deviceUser.deviceUserId,
          );

          return existing &&
            deviceUser.name &&
            existing.name !== deviceUser.name
            ? [
                this.prisma.employee.update({
                  where: { id: existing.id },
                  data: { name: deviceUser.name },
                }),
              ]
            : [];
        }),
      );

      const fetchedPunches =
        await this.zktecoService.getAttendancePunches(device);
      const { punchCutoff } = this.getRetentionCutoffs(databaseNow);
      const punches = fetchedPunches.filter(
        (punch) => punch.punchTime >= punchCutoff,
      );
      const deviceUserIds = Array.from(
        new Set(punches.map((punch) => punch.deviceUserId)),
      );
      const employees = await this.prisma.employee.findMany({
        where: {
          organizationId: device.organizationId,
          isActive: true,
          deviceUserId: {
            in: deviceUserIds,
          },
        },
        select: {
          id: true,
          deviceUserId: true,
          attendanceTrackingSince: true,
          shiftAssignments: {
            include: { shift: true },
            orderBy: { effectiveFrom: 'desc' },
          },
        },
      });
      const employeeByDeviceUserId = new Map(
        employees
          .filter((employee) => employee.deviceUserId)
          .map((employee) => [employee.deviceUserId as string, employee]),
      );
      const latestStoredLog = await this.prisma.attendanceLog.findFirst({
        where: { deviceId: device.id },
        orderBy: { punchTime: 'desc' },
        select: { punchTime: true },
      });
      const affectedDays = new Map<string, AffectedAttendanceDay>();
      const rawLogs = punches.flatMap((punch) => {
        const employee = employeeByDeviceUserId.get(punch.deviceUserId);

        if (
          !employee ||
          (employee.attendanceTrackingSince &&
            punch.punchTime < employee.attendanceTrackingSince)
        ) {
          return [];
        }
        const employeeId = employee.id;

        if (!latestStoredLog || punch.punchTime >= latestStoredLog.punchTime) {
          const dateKey = this.resolveShiftDateKey(
            punch.punchTime,
            timezone,
            employee.shiftAssignments,
          );
          if (dateKey) {
            affectedDays.set(`${employeeId}:${dateKey}`, {
              employeeId,
              organizationId: device.organizationId,
              dateKey,
              timezone,
            });
          }
        }

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
      if (createResult.count === 0) {
        affectedDays.clear();
      }
      let dailyCalculated = 0;
      const dailyAttendance: AttendanceUpdatedPayload['dailyAttendance'] = [];

      for (const affectedDay of affectedDays.values()) {
        const dailyRecord = await this.calculateDailyAttendance(
          affectedDay,
          databaseNow,
        );
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
          lastSync: databaseNow,
        },
      });

      this.realtimeGateway.emitDeviceConnected({
        organizationId: device.organizationId,
        deviceId: device.id,
        ip: device.ip,
        port: device.port,
        status: DeviceStatus.ACTIVE,
        emittedAt: databaseNow.toISOString(),
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
          emittedAt: databaseNow.toISOString(),
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
        emittedAt: databaseNow.toISOString(),
      });

      throw error;
    }
  }

  private async calculateDailyAttendance(
    day: AffectedAttendanceDay,
    databaseNow: Date,
  ) {
    const date = dateKeyToDatabaseDate(day.dateKey);
    const assignment = await this.prisma.employeeShiftAssignment.findFirst({
      where: {
        employeeId: day.employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!assignment) {
      throw new Error(
        `No shift assigned to employee ${day.employeeId} for ${day.dateKey}`,
      );
    }
    const crossesMidnight =
      assignment.shift.endMinutes <= assignment.shift.startMinutes;
    const scheduledStart = zonedDateTimeToUtc(
      day.dateKey,
      assignment.shift.startMinutes,
      day.timezone,
    );
    const scheduledEnd = zonedDateTimeToUtc(
      day.dateKey,
      assignment.shift.endMinutes,
      day.timezone,
      crossesMidnight ? 1 : 0,
    );
    const graceDeadline = new Date(
      scheduledStart.getTime() + GRACE_MINUTES * 60_000,
    );
    const window = {
      start: new Date(scheduledStart.getTime() - PUNCH_WINDOW_MINUTES * 60_000),
      end: new Date(scheduledEnd.getTime() + PUNCH_WINDOW_MINUTES * 60_000),
    };
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
    const dayLogs = logs;
    const existing = await this.prisma.dailyAttendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: day.employeeId,
          date: dateKeyToDatabaseDate(day.dateKey),
        },
      },
      select: { statusOverride: true },
    });
    const firstCheckIn = dayLogs[0]?.punchTime ?? null;
    const lastPunch = dayLogs[dayLogs.length - 1]?.punchTime ?? null;
    const lastCheckOut =
      firstCheckIn &&
      lastPunch &&
      lastPunch.getTime() !== firstCheckIn.getTime()
        ? lastPunch
        : null;
    const arrivedAfterDeadline =
      firstCheckIn !== null && firstCheckIn > graceDeadline;
    const status = firstCheckIn
      ? arrivedAfterDeadline
        ? AttendanceStatus.HALF_DAY
        : lastCheckOut
          ? AttendanceStatus.PRESENT
          : AttendanceStatus.MISSING_CHECKOUT
      : AttendanceStatus.ABSENT;
    const effectiveStatus = existing?.statusOverride ?? status;
    const shiftEnd = scheduledEnd;
    const automaticCheckoutStatuses = new Set<AttendanceStatus>([
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.MISSING_CHECKOUT,
    ]);
    const finalCheckOut =
      databaseNow.getTime() >= shiftEnd.getTime() &&
      automaticCheckoutStatuses.has(effectiveStatus)
        ? shiftEnd
        : lastCheckOut;
    const workingMinutes =
      firstCheckIn && finalCheckOut
        ? Math.max(
            0,
            Math.floor(
              (finalCheckOut.getTime() - firstCheckIn.getTime()) / 60_000,
            ),
          )
        : 0;

    return this.prisma.dailyAttendance.upsert({
      where: {
        employeeId_date: {
          employeeId: day.employeeId,
          date: dateKeyToDatabaseDate(day.dateKey),
        },
      },
      update: {
        firstCheckIn,
        lastCheckOut: finalCheckOut,
        workingMinutes,
        status,
        shiftId: assignment.shift.id,
        shiftNameSnapshot: assignment.shift.name,
        scheduledStart,
        scheduledEnd,
        graceDeadline,
      },
      create: {
        organizationId: day.organizationId,
        employeeId: day.employeeId,
        date: dateKeyToDatabaseDate(day.dateKey),
        firstCheckIn,
        lastCheckOut: finalCheckOut,
        workingMinutes,
        status,
        shiftId: assignment.shift.id,
        shiftNameSnapshot: assignment.shift.name,
        scheduledStart,
        scheduledEnd,
        graceDeadline,
      },
    });
  }

  private resolveShiftDateKey(
    punchTime: Date,
    timezone: string,
    assignments: Array<{
      effectiveFrom: Date;
      effectiveTo: Date | null;
      shift: { startMinutes: number; endMinutes: number };
    }>,
  ) {
    const localDateKey = getDateKeyInTimeZone(punchTime, timezone);
    const candidates = [localDateKey, this.toPreviousDateKey(localDateKey)];

    for (const dateKey of candidates) {
      const date = dateKeyToDatabaseDate(dateKey);
      const assignment = assignments.find(
        (item) =>
          item.effectiveFrom <= date &&
          (!item.effectiveTo || item.effectiveTo >= date),
      );
      if (!assignment) continue;
      const overnight =
        assignment.shift.endMinutes <= assignment.shift.startMinutes;
      const start = zonedDateTimeToUtc(
        dateKey,
        assignment.shift.startMinutes,
        timezone,
      );
      const end = zonedDateTimeToUtc(
        dateKey,
        assignment.shift.endMinutes,
        timezone,
        overnight ? 1 : 0,
      );
      if (
        punchTime >=
          new Date(start.getTime() - PUNCH_WINDOW_MINUTES * 60_000) &&
        punchTime <= new Date(end.getTime() + PUNCH_WINDOW_MINUTES * 60_000)
      )
        return dateKey;
    }

    return null;
  }

  private toPreviousDateKey(dateKey: string) {
    const date = dateKeyToDatabaseDate(dateKey);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  private getRetentionCutoffs(now: Date) {
    const pakistanDate = getDateKeyInTimeZone(now, 'Asia/Karachi');
    const [year, month] = pakistanDate.split('-').map(Number);
    const retainedMonthStart = new Date(Date.UTC(year, month - 2, 1));
    const retainedDateKey = retainedMonthStart.toISOString().slice(0, 10);

    return {
      retainedDateKey,
      dailyCutoff: dateKeyToDatabaseDate(retainedDateKey),
      punchCutoff: new Date(
        Date.UTC(
          retainedMonthStart.getUTCFullYear(),
          retainedMonthStart.getUTCMonth(),
          1,
        ) -
          5 * 60 * 60 * 1000,
      ),
    };
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
