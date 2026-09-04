import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';

import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  getDateKeyInTimeZone,
  zonedDateTimeToUtc,
} from '../attendance/utils/timezone';
import {
  AllRawPunchesQueryDto,
  DailyReportQueryDto,
  DateRangeReportQueryDto,
  LateArrivalsReportQueryDto,
  MonthlyReportQueryDto,
  OvertimeReportQueryDto,
  RawPunchesQueryDto,
} from './dto/report-query.dto';

const DEFAULT_LATE_THRESHOLD = '21:15';
const DEFAULT_OVERTIME_MINUTES = 480;
const GRACE_MINUTES = 15;
type ReportAttendanceStatus = AttendanceStatus | 'NOT_STARTED';
const PRESENT_STATUSES = new Set<AttendanceStatus>([
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.REMOTE,
]);

function displayEmployeeCode(employee: {
  employeeCode: string;
  deviceUserId: string | null;
}) {
  return employee.deviceUserId ?? employee.employeeCode;
}

type ReportScope = {
  organizationId?: string;
  employeeId?: string;
};

type AttendanceExportRow = {
  date: string;
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  organization: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workingMinutes: number;
  status: ReportAttendanceStatus;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(user: CurrentUser, query: DailyReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const dateKey = query.date
      ? this.normalizeDateKey(query.date)
      : await this.getCurrentShiftDateKey(scope.organizationId);
    const date = this.toDatabaseDate(dateKey);
    const employeeWhere = {
      isActive: true,
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.employeeId ? { id: scope.employeeId } : {}),
    };
    const [employees, dailyRecords, databaseNow] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeWhere,
        include: {
          department: true,
          organization: true,
          shiftAssignments: {
            where: {
              effectiveFrom: { lte: date },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
            },
            include: { shift: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
        orderBy: {
          employeeCode: 'asc',
        },
      }),
      this.prisma.dailyAttendance.findMany({
        where: {
          ...this.createAttendanceWhere(scope),
          date,
        },
      }),
      this.prisma.databaseNow(),
    ]);
    const recordsByEmployee = new Map(
      dailyRecords.map((record) => [record.employeeId, record]),
    );
    const rows = employees.map((employee) => {
      const record = recordsByEmployee.get(employee.id);
      const timezone = employee.organization.timezone || 'Asia/Karachi';
      const status = this.isTrackedForShiftDate(
        employee.attendanceTrackingSince,
        record,
        dateKey,
        timezone,
        employee.shiftAssignments,
      )
        ? this.resolveReportAttendanceStatus(
            record,
            dateKey,
            timezone,
            databaseNow,
            employee.shiftAssignments,
          )
        : 'NOT_STARTED';

      return {
        employeeId: employee.id,
        employeeCode: displayEmployeeCode(employee),
        employee: employee.name,
        department: employee.department?.name ?? 'Unassigned',
        organization: employee.organization.name,
        date: dateKey,
        firstCheckIn: record?.firstCheckIn?.toISOString() ?? null,
        lastCheckOut: record?.lastCheckOut?.toISOString() ?? null,
        workingMinutes: record?.workingMinutes ?? 0,
        status,
      };
    });

    return {
      date: dateKey,
      summary: this.summarizeDailyRows(rows),
      rows,
    };
  }

  async getMonthlyReport(user: CurrentUser, query: MonthlyReportQueryDto) {
    const monthKey = await this.normalizeMonthKey(query.month);
    const { from, to } = this.getMonthWindow(monthKey);
    const scope = this.resolveScope(user, query.organizationId);
    const [records, databaseNow] = await Promise.all([
      this.prisma.dailyAttendance.findMany({
        where: {
          ...this.createAttendanceWhere(scope),
          date: {
            gte: from,
            lt: to,
          },
        },
        include: {
          employee: {
            include: {
              department: true,
              shiftAssignments: {
                where: {
                  effectiveFrom: { lt: to },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
                },
                include: { shift: true },
                orderBy: { effectiveFrom: 'desc' },
              },
            },
          },
          organization: true,
        },
        orderBy: {
          date: 'asc',
        },
      }),
      this.prisma.databaseNow(),
    ]);
    const rowsByEmployee = new Map<
      string,
      {
        employeeId: string;
        employeeCode: string;
        employee: string;
        department: string;
        organization: string;
        presentDays: number;
        absentDays: number;
        lateDays: number;
        missingCheckoutDays: number;
        totalWorkingMinutes: number;
        overtimeMinutes: number;
      }
    >();

    for (const record of records) {
      const status = this.resolveReportAttendanceStatus(
        record,
        this.toDateKey(record.date),
        record.organization.timezone || 'Asia/Karachi',
        databaseNow,
        record.employee.shiftAssignments,
      );
      if (status === 'NOT_STARTED') continue;
      const current = rowsByEmployee.get(record.employeeId) ?? {
        employeeId: record.employeeId,
        employeeCode: displayEmployeeCode(record.employee),
        employee: record.employee.name,
        department: record.employee.department?.name ?? 'Unassigned',
        organization: record.organization.name,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        missingCheckoutDays: 0,
        totalWorkingMinutes: 0,
        overtimeMinutes: 0,
      };

      if (PRESENT_STATUSES.has(status)) {
        current.presentDays += 1;
      }

      if (status === AttendanceStatus.ABSENT) {
        current.absentDays += 1;
      }

      if (
        status === AttendanceStatus.LATE ||
        status === AttendanceStatus.HALF_DAY
      ) {
        current.lateDays += 1;
      }

      if (status === AttendanceStatus.MISSING_CHECKOUT) {
        current.missingCheckoutDays += 1;
      }

      current.totalWorkingMinutes += record.workingMinutes;
      current.overtimeMinutes += Math.max(
        0,
        record.workingMinutes - DEFAULT_OVERTIME_MINUTES,
      );
      rowsByEmployee.set(record.employeeId, current);
    }

    const rows = [...rowsByEmployee.values()].sort((left, right) =>
      left.employeeCode.localeCompare(right.employeeCode),
    );

    return {
      month: monthKey,
      summary: {
        employees: rows.length,
        presentDays: rows.reduce((total, row) => total + row.presentDays, 0),
        absentDays: rows.reduce((total, row) => total + row.absentDays, 0),
        lateDays: rows.reduce((total, row) => total + row.lateDays, 0),
        overtimeMinutes: rows.reduce(
          (total, row) => total + row.overtimeMinutes,
          0,
        ),
      },
      rows,
    };
  }

  async getPayrollReport(user: CurrentUser, query: MonthlyReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const [currentShiftDateKey, databaseNow] = await Promise.all([
      this.getCurrentShiftDateKey(scope.organizationId),
      this.prisma.databaseNow(),
    ]);
    const month = query.month
      ? await this.normalizeMonthKey(query.month)
      : this.getPayrollCycleMonth(currentShiftDateKey);
    const { from, to, cycleStart, cycleEnd } =
      this.getPayrollCycleWindow(month);
    const currentShiftDate = this.toDatabaseDate(currentShiftDateKey);
    const attendanceCutoff =
      currentShiftDate < from
        ? from
        : currentShiftDate >= to
          ? to
          : this.addDays(currentShiftDate, 1);
    const [employees, attendance] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          isActive: true,
          ...(scope.organizationId
            ? { organizationId: scope.organizationId }
            : {}),
          ...(scope.employeeId ? { id: scope.employeeId } : {}),
        },
        include: {
          department: true,
          organization: true,
          shiftAssignments: {
            where: {
              effectiveFrom: { lt: to },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
            },
            include: { shift: true },
            orderBy: { effectiveFrom: 'desc' },
          },
        },
        orderBy: { employeeCode: 'asc' },
      }),
      this.prisma.dailyAttendance.findMany({
        where: {
          ...this.createAttendanceWhere(scope),
          date: { gte: from, lt: attendanceCutoff },
        },
      }),
    ]);
    const attendanceByEmployeeDate = new Map(
      attendance.map((record) => [
        `${record.employeeId}:${this.toDateKey(record.date)}`,
        record,
      ]),
    );
    const workingDateKeys = this.getWeekdayDateKeys(from, to);
    const assessedDateKeys = this.getWeekdayDateKeys(from, attendanceCutoff);
    const payrollDays = Math.round(
      (to.getTime() - from.getTime()) / 86_400_000,
    );
    const employeeOrganizationIds = new Map(
      employees.map((employee) => [employee.id, employee.organizationId]),
    );
    const rows = employees.map((employee) => {
      let absentDays = 0;
      let halfDays = 0;
      let presentDays = 0;
      let assessedWorkingDays = 0;
      const attendanceDetails: Array<{
        date: string;
        day: string;
        status: 'ABSENT' | 'HALF_DAY';
      }> = [];

      for (const dateKey of assessedDateKeys) {
        const record = attendanceByEmployeeDate.get(
          `${employee.id}:${dateKey}`,
        );
        const timezone = employee.organization.timezone || 'Asia/Karachi';
        if (
          !this.isTrackedForShiftDate(
            employee.attendanceTrackingSince,
            record,
            dateKey,
            timezone,
            employee.shiftAssignments,
          )
        ) {
          continue;
        }
        const status = this.resolveReportAttendanceStatus(
          record,
          dateKey,
          timezone,
          databaseNow,
          employee.shiftAssignments,
        );

        if (status === 'NOT_STARTED') continue;
        assessedWorkingDays += 1;

        if (!status || status === AttendanceStatus.ABSENT) {
          absentDays += 1;
          attendanceDetails.push({
            date: dateKey,
            day: this.getWeekdayName(dateKey),
            status: 'ABSENT',
          });
        } else if (
          status === AttendanceStatus.LATE ||
          status === AttendanceStatus.HALF_DAY
        ) {
          halfDays += 1;
          attendanceDetails.push({
            date: dateKey,
            day: this.getWeekdayName(dateKey),
            status: 'HALF_DAY',
          });
        } else if (PRESENT_STATUSES.has(status)) {
          presentDays += 1;
        }
      }

      const monthlySalary = Number(employee.monthlySalary);
      const allowance = Number(employee.allowance);
      const dailyRate = payrollDays ? monthlySalary / payrollDays : 0;
      const halfDayDeductionDays = Math.floor(halfDays / 3);
      const totalDeductionDays = absentDays + halfDayDeductionDays;
      const salaryDeductionAmount = Math.min(
        monthlySalary,
        dailyRate * totalDeductionDays,
      );
      // The allowance is paid only when the employee has no deduction days.
      // Once there is at least one deduction day, the full allowance is
      // forfeited in addition to the normal per-day salary deduction.
      const allowanceDeductionAmount = totalDeductionDays > 0 ? allowance : 0;
      // Allowance is a deduction/forfeiture, not an addition to gross salary.
      // Gross salary therefore remains the employee's monthly salary.
      const grossSalary = monthlySalary;
      const deductionAmount = Math.min(
        grossSalary,
        salaryDeductionAmount + allowanceDeductionAmount,
      );

      return {
        employeeId: employee.id,
        employeeCode: displayEmployeeCode(employee),
        employee: employee.name,
        department: employee.department?.name ?? 'Unassigned',
        monthlySalary: this.roundMoney(monthlySalary),
        allowance: this.roundMoney(allowance),
        grossSalary: this.roundMoney(grossSalary),
        payrollDays,
        workingDays: workingDateKeys.length,
        assessedWorkingDays,
        dailyRate: this.roundMoney(dailyRate),
        salaryDeductionAmount: this.roundMoney(salaryDeductionAmount),
        allowanceDeductionAmount: this.roundMoney(allowanceDeductionAmount),
        presentDays,
        absentDays,
        halfDays,
        halfDayDeductionDays,
        totalDeductionDays,
        deductionAmount: this.roundMoney(deductionAmount),
        payableSalary: this.roundMoney(grossSalary - deductionAmount),
        attendanceDetails,
      };
    });

    const deductionRows = rows.map((row) => ({
      organizationId: employeeOrganizationIds.get(row.employeeId) ?? '',
      employeeId: row.employeeId,
      payrollCycleMonth: month,
      lateDays: 0,
      halfDays: row.halfDays,
      absentDays: row.absentDays,
      lateHalfDayDeductionDays: row.halfDayDeductionDays,
      totalDeductionDays: row.totalDeductionDays,
      monthlySalary: row.monthlySalary,
      payrollDays: row.payrollDays,
      dailyRate: row.dailyRate,
      deductionAmount: row.deductionAmount,
      calculatedThrough:
        attendanceCutoff > from
          ? this.toDateKey(this.addDays(attendanceCutoff, -1))
          : null,
    }));

    if (deductionRows.length > 0) {
      await this.prisma.$transaction([
        this.prisma.deduction.deleteMany({
          where: {
            payrollCycleMonth: month,
            employeeId: { in: rows.map((row) => row.employeeId) },
          },
        }),
        this.prisma.deduction.createMany({ data: deductionRows }),
      ]);
    }

    return {
      month,
      cycleStart,
      cycleEnd,
      calculatedThrough:
        attendanceCutoff > from
          ? this.toDateKey(this.addDays(attendanceCutoff, -1))
          : null,
      workingDays: workingDateKeys.length,
      payrollDays,
      rule: "Payroll runs every calendar day from the 25th through the following month's 25th. Saturdays and Sundays are paid off-days and never create deductions. A late arrival is a half day. Each absent weekday deducts 1 calendar-day salary; every 3 half days deduct 1 calendar-day salary. The full allowance is forfeited whenever at least one deduction day is assessed.",
      summary: {
        employees: rows.length,
        grossSalary: this.roundMoney(
          rows.reduce((total, row) => total + row.grossSalary, 0),
        ),
        deductions: this.roundMoney(
          rows.reduce((total, row) => total + row.deductionAmount, 0),
        ),
        payableSalary: this.roundMoney(
          rows.reduce((total, row) => total + row.payableSalary, 0),
        ),
      },
      rows,
    };
  }

  async getDeductionsReport(user: CurrentUser, query: MonthlyReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const month = query.month
      ? await this.normalizeMonthKey(query.month)
      : this.getPayrollCycleMonth(
          await this.getCurrentShiftDateKey(scope.organizationId),
        );

    const deductions = await this.prisma.deduction.findMany({
      where: {
        ...(scope.organizationId
          ? { organizationId: scope.organizationId }
          : {}),
        ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
        payrollCycleMonth: month,
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
      orderBy: {
        employee: {
          name: 'asc',
        },
      },
    });

    const rows = deductions.map((deduction) => ({
      employeeId: deduction.employeeId,
      employeeCode: displayEmployeeCode({
        employeeCode: deduction.employee.employeeCode,
        deviceUserId: deduction.employee.deviceUserId,
      }),
      employee: deduction.employee.name,
      department: deduction.employee.department?.name ?? 'Unassigned',
      payrollCycleMonth: deduction.payrollCycleMonth,
      // Older saved rows may still have late days in their legacy column.
      // Present them as the single half-day payroll category.
      halfDays: deduction.halfDays + deduction.lateDays,
      absentDays: deduction.absentDays,
      halfDayDeductionDays: deduction.lateHalfDayDeductionDays,
      totalDeductionDays: deduction.totalDeductionDays,
      monthlySalary: Number(deduction.monthlySalary),
      payrollDays: deduction.payrollDays,
      dailyRate: Number(deduction.dailyRate),
      deductionAmount: Number(deduction.deductionAmount),
      calculatedThrough: deduction.calculatedThrough,
    }));

    return {
      month,
      summary: {
        employees: rows.length,
        totalHalfDays: rows.reduce((total, row) => total + row.halfDays, 0),
        totalAbsentDays: rows.reduce((total, row) => total + row.absentDays, 0),
        totalHalfDayDeductionDays: rows.reduce(
          (total, row) => total + row.halfDayDeductionDays,
          0,
        ),
        totalDeductionDays: rows.reduce(
          (total, row) => total + row.totalDeductionDays,
          0,
        ),
        totalDeductionAmount: this.roundMoney(
          rows.reduce((total, row) => total + row.deductionAmount, 0),
        ),
      },
      rows,
    };
  }

  async getAttendanceExport(user: CurrentUser, query: DateRangeReportQueryDto) {
    if (!query.from || !query.to) {
      throw new BadRequestException('from and to dates are required');
    }

    const scope = this.resolveScope(user, query.organizationId);
    const { from, to } = await this.normalizeRange(query.from, query.to);
    const [employees, records, databaseNow] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          isActive: true,
          ...(scope.organizationId
            ? { organizationId: scope.organizationId }
            : {}),
          ...(scope.employeeId ? { id: scope.employeeId } : {}),
        },
        include: {
          department: true,
          organization: true,
          shiftAssignments: {
            where: {
              effectiveFrom: { lt: to },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
            },
            include: { shift: true },
            orderBy: { effectiveFrom: 'desc' },
          },
        },
        orderBy: { employeeCode: 'asc' },
      }),
      this.prisma.dailyAttendance.findMany({
        where: {
          ...this.createAttendanceWhere(scope),
          date: { gte: from, lt: to },
        },
      }),
      this.prisma.databaseNow(),
    ]);
    const recordsByEmployeeDate = new Map(
      records.map((record) => [
        `${record.employeeId}:${this.toDateKey(record.date)}`,
        record,
      ]),
    );
    const rows: AttendanceExportRow[] = [];

    for (let date = from; date < to; date = this.addDays(date, 1)) {
      const dateKey = this.toDateKey(date);

      for (const employee of employees) {
        const record = recordsByEmployeeDate.get(`${employee.id}:${dateKey}`);
        const timezone = employee.organization.timezone || 'Asia/Karachi';
        const isTracked = this.isTrackedForShiftDate(
          employee.attendanceTrackingSince,
          record,
          dateKey,
          timezone,
          employee.shiftAssignments,
        );

        rows.push({
          date: dateKey,
          employeeId: employee.id,
          employeeCode: displayEmployeeCode(employee),
          employee: employee.name,
          department: employee.department?.name ?? 'Unassigned',
          organization: employee.organization.name,
          firstCheckIn: record?.firstCheckIn?.toISOString() ?? null,
          lastCheckOut: record?.lastCheckOut?.toISOString() ?? null,
          workingMinutes: record?.workingMinutes ?? 0,
          status: isTracked
            ? this.resolveReportAttendanceStatus(
                record,
                dateKey,
                timezone,
                databaseNow,
                employee.shiftAssignments,
              )
            : 'NOT_STARTED',
        });
      }
    }

    return {
      from: this.toDateKey(from),
      to: this.toDateKey(this.addDays(to, -1)),
      rows,
    };
  }

  async getRawPunches(user: CurrentUser, query: RawPunchesQueryDto) {
    return this.queryRawPunches(user, query, false);
  }

  async getRawPunchesExport(user: CurrentUser, query: AllRawPunchesQueryDto) {
    const result = await this.queryRawPunches(user, query, true);
    return { data: result.data, total: result.total };
  }

  async getAllRawPunches(query: AllRawPunchesQueryDto) {
    const result = await this.queryRawPunches(null, query, true);
    return { data: result.data, total: result.total };
  }

  private async queryRawPunches(
    user: CurrentUser | null,
    query: AllRawPunchesQueryDto & { page?: number; pageSize?: number },
    includeAll: boolean,
  ) {
    const scope = user
      ? this.resolveScope(user, query.organizationId)
      : query.organizationId
        ? { organizationId: query.organizationId }
        : {};
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 100, 250);
    const search = query.search?.trim();
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException(
        'From date/time must be before To date/time',
      );
    }
    const matchingEmployeeIds = search
      ? (
          await this.prisma.employee.findMany({
            where: {
              ...(scope.organizationId
                ? { organizationId: scope.organizationId }
                : {}),
              ...(scope.employeeId ? { id: scope.employeeId } : {}),
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                {
                  employeeCode: { contains: search, mode: 'insensitive' },
                },
              ],
            },
            select: { id: true },
          })
        ).map((employee) => employee.id)
      : undefined;

    if (matchingEmployeeIds?.length === 0) {
      return { data: [], page, pageSize, total: 0 };
    }

    const where = {
      ...this.createAttendanceWhere(scope),
      ...(matchingEmployeeIds
        ? { employeeId: { in: matchingEmployeeIds } }
        : {}),
      ...((from || to) && {
        punchTime: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };
    const records = await this.prisma.attendanceLog.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        punchTime: true,
        verificationType: true,
        employee: {
          select: {
            employeeCode: true,
            deviceUserId: true,
            name: true,
            department: { select: { name: true } },
          },
        },
        deviceNameSnapshot: true,
        device: { select: { name: true } },
      },
      orderBy: { punchTime: 'desc' },
      ...(includeAll ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    });
    const total = includeAll
      ? records.length
      : await this.prisma.attendanceLog.count({ where });
    const employeeIds = [
      ...new Set(records.map((record) => record.employeeId)),
    ];
    const punchTimes = records.map((record) => record.punchTime.getTime());
    const attendance = employeeIds.length
      ? await this.prisma.dailyAttendance.findMany({
          where: {
            ...(scope.organizationId
              ? { organizationId: scope.organizationId }
              : {}),
            employeeId: { in: employeeIds },
            date: {
              gte: new Date(Math.min(...punchTimes) - 86_400_000),
              lte: new Date(Math.max(...punchTimes) + 86_400_000),
            },
          },
          select: { employeeId: true, firstCheckIn: true, lastCheckOut: true },
        })
      : [];
    const checkIns = new Set(
      attendance.flatMap((row) =>
        row.firstCheckIn
          ? [`${row.employeeId}:${row.firstCheckIn.getTime()}`]
          : [],
      ),
    );
    const checkOuts = new Set(
      attendance.flatMap((row) =>
        row.lastCheckOut
          ? [`${row.employeeId}:${row.lastCheckOut.getTime()}`]
          : [],
      ),
    );

    return {
      data: records.map((record) => {
        const punchKey = `${record.employeeId}:${record.punchTime.getTime()}`;
        return {
          id: record.id,
          employeeCode:
            record.employee.deviceUserId ?? record.employee.employeeCode,
          employee: record.employee.name,
          department: record.employee.department?.name ?? 'Unassigned',
          device:
            record.device?.name ??
            record.deviceNameSnapshot ??
            'Removed device',
          punchTime: record.punchTime.toISOString(),
          punchStatus: checkIns.has(punchKey)
            ? 'CHECK_IN'
            : checkOuts.has(punchKey)
              ? 'CHECK_OUT'
              : 'ADDITIONAL_PUNCH',
          verificationType: record.verificationType,
        };
      }),
      page,
      pageSize,
      total,
    };
  }

  async getEmployeeHistory(
    user: CurrentUser,
    employeeId: string,
    query: DateRangeReportQueryDto,
  ) {
    const scope = this.resolveScope(user, query.organizationId);

    if (scope.employeeId && scope.employeeId !== employeeId) {
      throw new ForbiddenException('Cannot view another employee history');
    }

    const { from, to } = await this.normalizeRange(query.from, query.to);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(scope.organizationId
          ? { organizationId: scope.organizationId }
          : {}),
      },
      include: {
        department: true,
        organization: true,
      },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found for report scope');
    }

    const rows = await this.prisma.dailyAttendance.findMany({
      where: {
        employeeId,
        date: {
          gte: from,
          lt: to,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      employee: {
        id: employee.id,
        employeeCode: displayEmployeeCode(employee),
        name: employee.name,
        department: employee.department?.name ?? 'Unassigned',
        organization: employee.organization.name,
      },
      from: this.toDateKey(from),
      to: this.toDateKey(this.addDays(to, -1)),
      rows: rows.map((row) => ({
        date: this.toDateKey(row.date),
        firstCheckIn: row.firstCheckIn?.toISOString() ?? null,
        lastCheckOut: row.lastCheckOut?.toISOString() ?? null,
        workingMinutes: row.workingMinutes,
        status: this.getEffectiveAttendanceStatus(row),
      })),
    };
  }

  async getLateArrivals(user: CurrentUser, query: LateArrivalsReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const threshold = query.threshold ?? DEFAULT_LATE_THRESHOLD;
    const { from, to } = await this.normalizeRange(query.from, query.to);
    const records = await this.getRangeRecords(scope, from, to);
    const rows = records
      .filter((record) => record.firstCheckIn)
      .map((record) => {
        const timezone = record.organization.timezone || 'UTC';
        const arrival = this.formatTime(record.firstCheckIn as Date, timezone);

        return {
          employeeId: record.employeeId,
          employeeCode: displayEmployeeCode(record.employee),
          employee: record.employee.name,
          department: record.employee.department?.name ?? 'Unassigned',
          organization: record.organization.name,
          date: this.toDateKey(record.date),
          arrival,
          threshold,
          minutesLate: this.diffTimesInMinutes(threshold, arrival),
          status: this.getEffectiveAttendanceStatus(record),
        };
      })
      .filter((row) => row.minutesLate > 0)
      .sort((left, right) => right.minutesLate - left.minutesLate);

    return {
      from: this.toDateKey(from),
      to: this.toDateKey(this.addDays(to, -1)),
      threshold,
      summary: {
        count: rows.length,
        averageMinutesLate:
          rows.length > 0
            ? Math.round(
                rows.reduce((total, row) => total + row.minutesLate, 0) /
                  rows.length,
              )
            : 0,
      },
      rows,
    };
  }

  async getOvertime(user: CurrentUser, query: OvertimeReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const minimumMinutes = query.minimumMinutes ?? DEFAULT_OVERTIME_MINUTES;
    const { from, to } = await this.normalizeRange(query.from, query.to);
    const records = await this.getRangeRecords(scope, from, to);
    const rows = records
      .filter((record) => record.workingMinutes > minimumMinutes)
      .map((record) => ({
        employeeId: record.employeeId,
        employeeCode: displayEmployeeCode(record.employee),
        employee: record.employee.name,
        department: record.employee.department?.name ?? 'Unassigned',
        organization: record.organization.name,
        date: this.toDateKey(record.date),
        workingMinutes: record.workingMinutes,
        overtimeMinutes: record.workingMinutes - minimumMinutes,
        status: this.getEffectiveAttendanceStatus(record),
      }))
      .sort((left, right) => right.overtimeMinutes - left.overtimeMinutes);

    return {
      from: this.toDateKey(from),
      to: this.toDateKey(this.addDays(to, -1)),
      minimumMinutes,
      summary: {
        count: rows.length,
        overtimeMinutes: rows.reduce(
          (total, row) => total + row.overtimeMinutes,
          0,
        ),
      },
      rows,
    };
  }

  async getAnalytics(user: CurrentUser, query: DateRangeReportQueryDto) {
    const scope = this.resolveScope(user, query.organizationId);
    const { from, to } = await this.normalizeRange(query.from, query.to);
    const [records, employees, databaseNow] = await Promise.all([
      this.getRangeRecords(scope, from, to),
      this.prisma.employee.findMany({
        where: {
          isActive: true,
          ...(scope.organizationId
            ? { organizationId: scope.organizationId }
            : {}),
          ...(scope.employeeId ? { id: scope.employeeId } : {}),
        },
        include: {
          department: true,
          organization: true,
          shiftAssignments: {
            where: {
              effectiveFrom: { lt: to },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
            },
            include: { shift: true },
            orderBy: { effectiveFrom: 'desc' },
          },
        },
      }),
      this.prisma.databaseNow(),
    ]);
    const trends = new Map<
      string,
      {
        date: string;
        present: number;
        absent: number;
        late: number;
        overtimeHours: number;
        averageWorkingHours: number;
        totalWorkingMinutes: number;
        rows: number;
      }
    >();
    const departments = new Map<
      string,
      {
        department: string;
        present: number;
        absent: number;
        late: number;
        overtimeHours: number;
        averageWorkingHours: number;
        totalWorkingMinutes: number;
        rows: number;
      }
    >();
    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );
    const recordByEmployeeDate = new Map(
      records.map((record) => [
        `${record.employeeId}:${this.toDateKey(record.date)}`,
        record,
      ]),
    );
    const assessedEmployeesByDate = new Map<string, number>();
    const assessedEmployeeDaysByDepartment = new Map<string, number>();

    for (let date = from; date < to; date = this.addDays(date, 1)) {
      const dateKey = this.toDateKey(date);
      let assessedEmployees = 0;
      for (const employee of employees) {
        const record = recordByEmployeeDate.get(`${employee.id}:${dateKey}`);
        const timezone = employee.organization.timezone || 'Asia/Karachi';
        if (
          !this.isTrackedForShiftDate(
            employee.attendanceTrackingSince,
            record,
            dateKey,
            timezone,
            employee.shiftAssignments,
          )
        ) {
          continue;
        }
        const status = this.resolveReportAttendanceStatus(
          record,
          dateKey,
          timezone,
          databaseNow,
          employee.shiftAssignments,
        );
        if (status === 'NOT_STARTED') continue;

        assessedEmployees += 1;
        const departmentName = employee.department?.name ?? 'Unassigned';
        assessedEmployeeDaysByDepartment.set(
          departmentName,
          (assessedEmployeeDaysByDepartment.get(departmentName) ?? 0) + 1,
        );
      }
      assessedEmployeesByDate.set(dateKey, assessedEmployees);
      trends.set(dateKey, {
        date: dateKey,
        present: 0,
        absent: assessedEmployees,
        late: 0,
        overtimeHours: 0,
        averageWorkingHours: 0,
        totalWorkingMinutes: 0,
        rows: 0,
      });
    }

    for (const employee of employees) {
      const departmentName = employee.department?.name ?? 'Unassigned';
      departments.set(departmentName, {
        department: departmentName,
        present: 0,
        absent: 0,
        late: 0,
        overtimeHours: 0,
        averageWorkingHours: 0,
        totalWorkingMinutes: 0,
        rows: 0,
      });
    }

    for (const record of records) {
      const dateKey = this.toDateKey(record.date);
      const employee = employeeById.get(record.employeeId);
      if (!employee) continue;
      const status = this.resolveReportAttendanceStatus(
        record,
        dateKey,
        employee.organization.timezone || 'Asia/Karachi',
        databaseNow,
        employee.shiftAssignments,
      );
      if (status === 'NOT_STARTED') continue;

      const departmentName = employee.department?.name ?? 'Unassigned';
      const trend = trends.get(dateKey) ?? {
        date: dateKey,
        present: 0,
        absent: 0,
        late: 0,
        overtimeHours: 0,
        averageWorkingHours: 0,
        totalWorkingMinutes: 0,
        rows: 0,
      };
      const department = departments.get(departmentName) ?? {
        department: departmentName,
        present: 0,
        absent: 0,
        late: 0,
        overtimeHours: 0,
        averageWorkingHours: 0,
        totalWorkingMinutes: 0,
        rows: 0,
      };

      this.applyAnalyticsRecord(trend, status, record.workingMinutes);
      this.applyAnalyticsRecord(department, status, record.workingMinutes);
      trends.set(dateKey, trend);
      departments.set(departmentName, department);
    }

    for (const trend of trends.values()) {
      trend.absent = Math.max(
        0,
        (assessedEmployeesByDate.get(trend.date) ?? 0) - trend.present,
      );
    }

    for (const department of departments.values()) {
      department.absent = Math.max(
        0,
        (assessedEmployeeDaysByDepartment.get(department.department) ?? 0) -
          department.present,
      );
    }

    const finalize = <
      T extends {
        totalWorkingMinutes: number;
        rows: number;
        averageWorkingHours: number;
        overtimeHours: number;
      },
    >(
      row: T,
    ) => ({
      ...row,
      overtimeHours: Number(row.overtimeHours.toFixed(1)),
      averageWorkingHours:
        row.rows > 0
          ? Number((row.totalWorkingMinutes / row.rows / 60).toFixed(1))
          : 0,
    });

    return {
      from: this.toDateKey(from),
      to: this.toDateKey(this.addDays(to, -1)),
      trends: [...trends.values()]
        .map(finalize)
        .sort((left, right) => left.date.localeCompare(right.date)),
      departments: [...departments.values()]
        .map(finalize)
        .sort((left, right) => left.department.localeCompare(right.department)),
    };
  }

  private getRangeRecords(scope: ReportScope, from: Date, to: Date) {
    return this.prisma.dailyAttendance.findMany({
      where: {
        ...this.createAttendanceWhere(scope),
        date: {
          gte: from,
          lt: to,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        organization: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  private applyAnalyticsRecord(
    row: {
      present: number;
      absent: number;
      late: number;
      overtimeHours: number;
      totalWorkingMinutes: number;
      rows: number;
    },
    status: AttendanceStatus,
    workingMinutes: number,
  ) {
    if (PRESENT_STATUSES.has(status)) {
      row.present += 1;
    }

    if (status === AttendanceStatus.ABSENT) {
      row.absent += 1;
    }

    if (
      status === AttendanceStatus.LATE ||
      status === AttendanceStatus.HALF_DAY
    ) {
      row.late += 1;
    }

    row.overtimeHours +=
      Math.max(0, workingMinutes - DEFAULT_OVERTIME_MINUTES) / 60;
    row.totalWorkingMinutes += workingMinutes;
    row.rows += 1;
  }

  private resolveScope(
    user: CurrentUser,
    requestedOrganizationId?: string,
  ): ReportScope {
    if (user.role === UserRole.SUPER_ADMIN) {
      return requestedOrganizationId
        ? { organizationId: requestedOrganizationId }
        : {};
    }

    if (!user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    if (
      requestedOrganizationId &&
      requestedOrganizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot access another organization report');
    }

    return {
      organizationId: user.organizationId,
      ...(user.role === UserRole.EMPLOYEE
        ? { employeeId: this.resolveEmployeeId(user) }
        : {}),
    };
  }

  private resolveEmployeeId(user: CurrentUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return user.employeeId;
  }

  private createAttendanceWhere(scope: ReportScope) {
    return {
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
    };
  }

  private async getCurrentShiftDateKey(organizationId?: string) {
    const organization = organizationId
      ? await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { timezone: true },
        })
      : await this.prisma.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { timezone: true },
        });
    const timezone = organization?.timezone || 'Asia/Karachi';
    const now = await this.prisma.databaseNow();
    const dateKey = getDateKeyInTimeZone(now, timezone);
    return dateKey;
  }

  private resolveReportAttendanceStatus(
    record:
      | {
          status: AttendanceStatus;
          statusOverride: AttendanceStatus | null;
          firstCheckIn: Date | null;
          lastCheckOut: Date | null;
          graceDeadline: Date | null;
        }
      | undefined,
    dateKey: string,
    timezone: string,
    databaseNow: Date,
    assignments: Array<{
      effectiveFrom: Date;
      effectiveTo: Date | null;
      shift: { startMinutes: number };
    }>,
  ): ReportAttendanceStatus {
    if (record?.statusOverride) {
      return this.getEffectiveAttendanceStatus(record);
    }

    if (
      record &&
      this.getEffectiveAttendanceStatus(record) !== AttendanceStatus.ABSENT
    ) {
      return this.getEffectiveAttendanceStatus(record);
    }

    const currentDateKey = getDateKeyInTimeZone(databaseNow, timezone);
    if (dateKey > currentDateKey) return 'NOT_STARTED';
    if (dateKey < currentDateKey) return AttendanceStatus.ABSENT;

    const date = this.toDatabaseDate(dateKey);
    const assignment = assignments.find(
      (item) =>
        item.effectiveFrom <= date &&
        (!item.effectiveTo || item.effectiveTo >= date),
    );
    const graceDeadline =
      record?.graceDeadline ??
      (assignment
        ? new Date(
            zonedDateTimeToUtc(
              dateKey,
              assignment.shift.startMinutes,
              timezone,
            ).getTime() +
              GRACE_MINUTES * 60_000,
          )
        : null);

    // Without a valid shift there is no reliable point at which absence can
    // begin, so avoid charging an absence for the current date.
    if (!graceDeadline) return 'NOT_STARTED';

    const graceMinuteEnd = new Date(graceDeadline.getTime() + 60_000 - 1);
    return databaseNow <= graceMinuteEnd
      ? 'NOT_STARTED'
      : AttendanceStatus.ABSENT;
  }

  private isTrackedForShiftDate(
    trackingSince: Date | null,
    record: { firstCheckIn: Date | null } | undefined,
    dateKey: string,
    timezone: string,
    assignments: Array<{
      effectiveFrom: Date;
      effectiveTo: Date | null;
      shift: { startMinutes: number };
    }>,
  ) {
    if (!trackingSince) return true;

    const date = this.toDatabaseDate(dateKey);
    const assignment = assignments.find(
      (item) =>
        item.effectiveFrom <= date &&
        (!item.effectiveTo || item.effectiveTo >= date),
    );
    if (assignment) {
      const scheduledStart = zonedDateTimeToUtc(
        dateKey,
        assignment.shift.startMinutes,
        timezone,
      );
      if (trackingSince <= scheduledStart) return true;
    }

    // If activation happened after this shift began, only a new punch made
    // after activation opts the employee into that partial shift. Otherwise
    // the first assessable shift is the next one.
    return Boolean(
      record?.firstCheckIn && record.firstCheckIn.getTime() >= trackingSince.getTime(),
    );
  }

  private summarizeDailyRows(
    rows: Array<{ status: ReportAttendanceStatus; workingMinutes: number }>,
  ) {
    return {
      totalEmployees: rows.length,
      presentCount: rows.filter(
        (row) =>
          row.status !== 'NOT_STARTED' && PRESENT_STATUSES.has(row.status),
      ).length,
      absentCount: rows.filter((row) => row.status === AttendanceStatus.ABSENT)
        .length,
      lateCount: rows.filter(
        (row) =>
          row.status === AttendanceStatus.LATE ||
          row.status === AttendanceStatus.HALF_DAY,
      ).length,
      missingCheckoutCount: rows.filter(
        (row) => row.status === AttendanceStatus.MISSING_CHECKOUT,
      ).length,
      totalWorkingMinutes: rows.reduce(
        (total, row) => total + row.workingMinutes,
        0,
      ),
    };
  }

  private getEffectiveAttendanceStatus(record: {
    status: AttendanceStatus;
    statusOverride: AttendanceStatus | null;
    firstCheckIn: Date | null;
    lastCheckOut: Date | null;
    graceDeadline: Date | null;
  }) {
    const storedStatus = record.statusOverride ?? record.status;

    // MISSING_CHECKOUT was used by older processing runs. It is no longer a
    // user-facing status: an on-time punch is Present and a late punch is
    // Late, regardless of whether checkout has arrived yet.
    if (storedStatus === AttendanceStatus.MISSING_CHECKOUT) {
      if (!record.firstCheckIn) return AttendanceStatus.ABSENT;

      const graceMinuteEnd = record.graceDeadline
        ? new Date(record.graceDeadline.getTime() + 60_000 - 1)
        : null;
      return graceMinuteEnd && record.firstCheckIn > graceMinuteEnd
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;
    }

    if (record.statusOverride || record.status !== AttendanceStatus.LATE) {
      return storedStatus;
    }

    // Daily rows may have been calculated before the inclusive grace-minute
    // rule was introduced. Correct those persisted rows at read time too.
    const graceMinuteEnd = record.graceDeadline
      ? new Date(record.graceDeadline.getTime() + 60_000 - 1)
      : null;
    if (
      record.firstCheckIn &&
      graceMinuteEnd &&
      record.firstCheckIn <= graceMinuteEnd
    ) {
      return record.lastCheckOut
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.PRESENT;
    }

    return record.status;
  }

  private async normalizeRange(from?: string, to?: string) {
    const databaseNow = await this.prisma.databaseNow();
    const fallbackDateKey = getDateKeyInTimeZone(databaseNow, 'Asia/Karachi');
    const fallbackTo = this.toDatabaseDate(fallbackDateKey);
    const fallbackFrom = this.addDays(fallbackTo, -6);
    const fromDate = from
      ? this.toDatabaseDate(this.normalizeDateKey(from))
      : fallbackFrom;
    const toDate = to
      ? this.addDays(this.toDatabaseDate(this.normalizeDateKey(to)), 1)
      : this.addDays(fallbackTo, 1);

    if (fromDate >= toDate) {
      throw new BadRequestException('from must be before to');
    }

    return {
      from: fromDate,
      to: toDate,
    };
  }

  private normalizeDateKey(date: string) {
    const value = date;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Date must use YYYY-MM-DD');
    }

    return value;
  }

  private async normalizeMonthKey(month?: string) {
    const value =
      month ??
      getDateKeyInTimeZone(
        await this.prisma.databaseNow(),
        'Asia/Karachi',
      ).slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('Month must use YYYY-MM');
    }

    return value;
  }

  private getMonthWindow(monthKey: string) {
    const from = this.toDatabaseDate(`${monthKey}-01`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);

    return {
      from,
      to,
    };
  }

  private getPayrollCycleMonth(currentShiftDateKey: string) {
    const day = Number(currentShiftDateKey.slice(8, 10));

    if (day >= 25) {
      return currentShiftDateKey.slice(0, 7);
    }

    const currentMonthStart = this.toDatabaseDate(
      `${currentShiftDateKey.slice(0, 7)}-01`,
    );
    currentMonthStart.setUTCMonth(currentMonthStart.getUTCMonth() - 1);
    return this.toDateKey(currentMonthStart).slice(0, 7);
  }

  private getPayrollCycleWindow(monthKey: string) {
    const from = this.toDatabaseDate(`${monthKey}-25`);
    const cycleEndDate = this.toDatabaseDate(`${monthKey}-25`);
    cycleEndDate.setUTCMonth(cycleEndDate.getUTCMonth() + 1);
    const cycleStart = this.toDateKey(from);
    const cycleEnd = this.toDateKey(cycleEndDate);

    return {
      from,
      to: this.addDays(cycleEndDate, 1),
      cycleStart,
      cycleEnd,
    };
  }

  private toDatabaseDate(dateKey: string) {
    return new Date(`${dateKey}T00:00:00.000Z`);
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private getWeekdayDateKeys(from: Date, to: Date) {
    const dates: string[] = [];

    for (let date = from; date < to; date = this.addDays(date, 1)) {
      const weekday = date.getUTCDay();

      if (weekday !== 0 && weekday !== 6) {
        dates.push(this.toDateKey(date));
      }
    }

    return dates;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getWeekdayName(dateKey: string) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(this.toDatabaseDate(dateKey));
  }

  private formatTime(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private diffTimesInMinutes(start: string, end: string) {
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);

    const startTotal = startHours * 60 + startMinutes;
    let endTotal = endHours * 60 + endMinutes;

    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    return endTotal - startTotal;
  }
}
