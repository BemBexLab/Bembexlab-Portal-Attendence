import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';

import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  dateKeyToDatabaseDate,
  getDateKeyInTimeZone,
  getPakistanShiftEnd,
  zonedDateTimeToUtc,
} from './utils/timezone';
import type { UpdateAttendanceStatusDto } from './dto/update-attendance-status.dto';
import type { BulkAttendanceStatusDto } from './dto/bulk-attendance-status.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getScheduledStatuses(user: CurrentUser) {
    const databaseNow = await this.prisma.databaseNow();
    const today = dateKeyToDatabaseDate(
      getDateKeyInTimeZone(databaseNow, 'Asia/Karachi'),
    );
    const records = await this.prisma.dailyAttendance.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: user.organizationId as string }),
        date: { gte: today },
        statusOverride: {
          in: [AttendanceStatus.REMOTE, AttendanceStatus.ON_LEAVE],
        },
      },
      include: {
        employee: { include: { department: true } },
      },
      orderBy: [{ date: 'asc' }, { employee: { employeeCode: 'asc' } }],
    });

    return records.map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeCode:
        record.employee.deviceUserId ?? record.employee.employeeCode,
      employee: record.employee.name,
      department: record.employee.department?.name ?? 'Unassigned',
      date: record.date.toISOString().slice(0, 10),
      status: record.statusOverride,
    }));
  }

  async assignBulkStatus(user: CurrentUser, dto: BulkAttendanceStatusDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, organizationId: true, isActive: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive) {
      throw new BadRequestException('Cannot schedule an inactive employee');
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const from = dateKeyToDatabaseDate(dto.from);
    const to = dateKeyToDatabaseDate(dto.to);

    if (from > to) {
      throw new BadRequestException('from must be on or before to');
    }

    const databaseNow = await this.prisma.databaseNow();
    const today = dateKeyToDatabaseDate(
      getDateKeyInTimeZone(databaseNow, 'Asia/Karachi'),
    );

    if (from < today) {
      throw new BadRequestException(
        'Bulk status can only be scheduled in advance',
      );
    }

    const dates: Date[] = [];

    for (let date = from; date <= to;) {
      const weekday = date.getUTCDay();

      if (weekday !== 0 && weekday !== 6) {
        dates.push(date);
      }

      const next = dateKeyToDatabaseDate(date.toISOString().slice(0, 10));
      next.setUTCDate(next.getUTCDate() + 1);
      date = next;
    }

    await this.prisma.$transaction(
      dates.map((date) =>
        this.prisma.dailyAttendance.upsert({
          where: { employeeId_date: { employeeId: employee.id, date } },
          update: {
            statusOverride: dto.status,
            statusOverrideAt: databaseNow,
            statusOverrideBy: user.id,
            lastCheckOut: null,
            workingMinutes: 0,
          },
          create: {
            organizationId: employee.organizationId,
            employeeId: employee.id,
            date,
            status: dto.status,
            statusOverride: dto.status,
            statusOverrideAt: databaseNow,
            statusOverrideBy: user.id,
          },
        }),
      ),
    );

    return {
      employeeId: employee.id,
      status: dto.status,
      from: dto.from,
      to: dto.to,
      assignedDates: dates.map((date) => date.toISOString().slice(0, 10)),
      skippedWeekendDays:
        Math.floor((to.getTime() - from.getTime()) / 86_400_000) +
        1 -
        dates.length,
    };
  }

  async removeScheduledStatus(user: CurrentUser, id: string) {
    const record = await this.prisma.dailyAttendance.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        date: true,
        firstCheckIn: true,
        lastCheckOut: true,
        statusOverride: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Scheduled assignment not found');
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      record.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const databaseNow = await this.prisma.databaseNow();
    const today = dateKeyToDatabaseDate(
      getDateKeyInTimeZone(databaseNow, 'Asia/Karachi'),
    );

    if (
      record.date < today ||
      (record.statusOverride !== AttendanceStatus.REMOTE &&
        record.statusOverride !== AttendanceStatus.ON_LEAVE)
    ) {
      throw new NotFoundException('Scheduled assignment not found');
    }

    if (!record.firstCheckIn && !record.lastCheckOut) {
      await this.prisma.dailyAttendance.delete({ where: { id } });
    } else {
      await this.prisma.dailyAttendance.update({
        where: { id },
        data: {
          statusOverride: null,
          statusOverrideAt: null,
          statusOverrideBy: null,
        },
      });
    }

    return { id, removed: true };
  }

  async updateStatus(
    user: CurrentUser,
    employeeId: string,
    dateKey: string,
    dto: UpdateAttendanceStatusDto,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new BadRequestException('Date must use YYYY-MM-DD');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { timezone: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const date = dateKeyToDatabaseDate(dateKey);
    const databaseNow = await this.prisma.databaseNow();
    const existingAttendance = await this.prisma.dailyAttendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
      select: { lastCheckOut: true },
    });
    const assignment = await this.prisma.employeeShiftAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const shiftEnd = assignment
      ? zonedDateTimeToUtc(
          dateKey,
          assignment.shift.endMinutes,
          employee.organization.timezone || 'Asia/Karachi',
          assignment.shift.endMinutes <= assignment.shift.startMinutes ? 1 : 0,
        )
      : getPakistanShiftEnd(dateKey);
    const automaticCheckout = [
      'PRESENT',
      'HALF_DAY',
      'MISSING_CHECKOUT',
    ].includes(dto.status)
      ? shiftEnd
      : undefined;
    const automaticCheckoutAt = new Date(shiftEnd.getTime() + 60 * 60_000);
    const removePreviousAutomaticCheckout =
      (dto.status === AttendanceStatus.REMOTE ||
        dto.status === AttendanceStatus.ON_LEAVE) &&
      existingAttendance?.lastCheckOut?.getTime() === shiftEnd.getTime();
    return this.prisma.dailyAttendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        statusOverride: dto.status,
        statusOverrideAt: databaseNow,
        statusOverrideBy: user.id,
        ...(automaticCheckout && automaticCheckoutAt <= databaseNow
          ? { lastCheckOut: automaticCheckout }
          : {}),
        ...(removePreviousAutomaticCheckout ? { lastCheckOut: null } : {}),
      },
      create: {
        organizationId: employee.organizationId,
        employeeId,
        date,
        status: dto.status,
        statusOverride: dto.status,
        statusOverrideAt: databaseNow,
        statusOverrideBy: user.id,
        ...(automaticCheckout && automaticCheckoutAt <= databaseNow
          ? { lastCheckOut: automaticCheckout }
          : {}),
      },
    });
  }
}
