import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  dateKeyToDatabaseDate,
  getPakistanShiftEnd,
} from './utils/timezone';
import type { UpdateAttendanceStatusDto } from './dto/update-attendance-status.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

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
      select: { id: true, organizationId: true },
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
    const shiftEnd = getPakistanShiftEnd(dateKey);
    const automaticCheckout = [
      'PRESENT',
      'HALF_DAY',
      'MISSING_CHECKOUT',
    ].includes(dto.status)
      ? shiftEnd
      : undefined;
    const removePreviousAutomaticCheckout =
      dto.status === 'REMOTE' &&
      existingAttendance?.lastCheckOut?.getTime() === shiftEnd.getTime();
    return this.prisma.dailyAttendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        statusOverride: dto.status,
        statusOverrideAt: databaseNow,
        statusOverrideBy: user.id,
        ...(automaticCheckout && automaticCheckout <= databaseNow
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
        ...(automaticCheckout && automaticCheckout <= databaseNow
          ? { lastCheckOut: automaticCheckout }
          : {}),
      },
    });
  }
}
