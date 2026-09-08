import { ConflictException, ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import {
  EmployeeEarningStatus,
  EmployeeLoanStatus,
  User,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import {
  dateKeyToDatabaseDate,
  getDateKeyInTimeZone,
} from '../attendance/utils/timezone';
import { UpdateEmployeeCredentialsDto } from './dto/update-employee-credentials.dto';
import { CreateEmployeeEarningDto } from './dto/create-employee-earning.dto';
import { UpdateEmployeeEarningStatusDto } from './dto/update-employee-earning-status.dto';
import { CreateEmployeeLoanDto } from './dto/create-employee-loan.dto';
import { UpdateEmployeeLoanDto } from './dto/update-employee-loan.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  // Employee directory reads are frequent during navigation. The default
  // shift check only needs to run occasionally; deduplicate concurrent checks
  // and avoid repeating the same three database queries on every request.
  private readonly defaultShiftAssignmentCheckedAt = new Map<string, number>();
  private readonly defaultShiftAssignmentChecks = new Map<string, Promise<void>>();
  private readonly defaultShiftAssignmentTtlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.withTransientConnectionRetry(() =>
      this.prisma.user.findUnique({
        where: {
          email: email.toLowerCase().trim(),
        },
        select: {
          id: true,
          organizationId: true,
          employeeId: true,
          name: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  findById(id: string) {
    return this.withTransientConnectionRetry(() =>
      this.prisma.user.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          organizationId: true,
          employeeId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
    );
  }

  async listEmployees(user: CurrentUser) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    if (user.role === UserRole.EMPLOYEE && !user.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    const organizationIds = user.role === UserRole.SUPER_ADMIN
      ? (await this.prisma.organization.findMany({ select: { id: true } })).map(
          (organization) => organization.id,
        )
      : [user.organizationId as string];

    const findEmployees = () => this.prisma.employee.findMany({
      where: {
        deviceUserId: { not: null },
        // Device-removed employees remain hidden while their historical rows
        // stay intact. Manually paused employees remain visible so an admin
        // can activate them again from the employee directory.
        OR: [{ isActive: true }, { attendancePausedAt: { not: null } }],
        ...(user.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: user.organizationId as string }),
        ...(user.role === UserRole.EMPLOYEE
          ? { id: user.employeeId as string }
          : {}),
      },
      include: {
        department: true,
        shiftAssignments: {
          include: { shift: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });

    let employees = await findEmployees();
    // Most requests already have assignments. Only pay the default-shift
    // setup cost when the result actually contains an unassigned employee.
    if (employees.some((employee) => employee.shiftAssignments.length === 0)) {
      for (const organizationId of organizationIds) {
        await this.ensureDefaultShiftAssignments(organizationId);
      }
      employees = await findEmployees();
    }

    return employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.deviceUserId ?? employee.employeeCode,
      name: employee.name,
      department: employee.department?.name ?? null,
      deviceUserId: employee.deviceUserId,
      isActive: employee.isActive,
      monthlySalary: employee.monthlySalary.toString(),
      allowance: employee.allowance.toString(),
      shift: employee.shiftAssignments[0]
        ? {
            id: employee.shiftAssignments[0].shift.id,
            name: employee.shiftAssignments[0].shift.name,
            startMinutes: employee.shiftAssignments[0].shift.startMinutes,
            endMinutes: employee.shiftAssignments[0].shift.endMinutes,
            effectiveFrom: employee.shiftAssignments[0].effectiveFrom
              .toISOString()
              .slice(0, 10),
          }
        : null,
    }));
  }

  async listEmployeeCredentials(user: CurrentUser) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const employees = await this.prisma.employee.findMany({
      where:
        user.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: user.organizationId as string },
      select: {
        id: true,
        employeeCode: true,
        deviceUserId: true,
        name: true,
        isActive: true,
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { employeeCode: 'asc' }],
    });

    return employees.map((employee) => ({
      employeeId: employee.id,
      employeeCode: employee.deviceUserId ?? employee.employeeCode,
      name: employee.name,
      isActive: employee.isActive,
      email: employee.user?.email ?? null,
      hasPassword: Boolean(employee.user),
      loginActive: employee.user?.isActive ?? false,
    }));
  }

  async updateEmployeeCredentials(
    user: CurrentUser,
    employeeId: string,
    dto: UpdateEmployeeCredentialsDto,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        organizationId: true,
        employeeCode: true,
        deviceUserId: true,
        name: true,
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new BadRequestException('Employee not found');
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const email = dto.email.trim().toLowerCase();
    const emailOwner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== employee.user?.id) {
      throw new ConflictException('This email address is already in use');
    }
    if (!employee.user && !dto.password) {
      throw new BadRequestException('A password is required for a new login');
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    try {
      const account = employee.user
        ? await this.prisma.user.update({
            where: { id: employee.user.id },
            data: {
              email,
              name: employee.name,
              role: UserRole.EMPLOYEE,
              organizationId: employee.organizationId,
              ...(passwordHash ? { passwordHash } : {}),
            },
            select: { id: true, email: true, isActive: true },
          })
        : await this.prisma.user.create({
            data: {
              organizationId: employee.organizationId,
              employeeId: employee.id,
              name: employee.name,
              email,
              passwordHash: passwordHash as string,
              role: UserRole.EMPLOYEE,
              isActive: true,
            },
            select: { id: true, email: true, isActive: true },
          });

      return {
        employeeId: employee.id,
        employeeCode: employee.deviceUserId ?? employee.employeeCode,
        name: employee.name,
        email: account.email,
        hasPassword: true,
        loginActive: account.isActive,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('This email address is already in use');
      }
      throw error;
    }
  }

  private async ensureDefaultShiftAssignments(organizationId: string) {
    const now = Date.now();
    const checkedAt = this.defaultShiftAssignmentCheckedAt.get(organizationId);
    if (checkedAt && now - checkedAt < this.defaultShiftAssignmentTtlMs) {
      return;
    }

    const running = this.defaultShiftAssignmentChecks.get(organizationId);
    if (running) {
      await running;
      return;
    }

    const check = this.ensureDefaultShiftAssignmentsInternal(organizationId);
    this.defaultShiftAssignmentChecks.set(organizationId, check);
    try {
      await check;
      this.defaultShiftAssignmentCheckedAt.set(organizationId, Date.now());
    } finally {
      if (this.defaultShiftAssignmentChecks.get(organizationId) === check) {
        this.defaultShiftAssignmentChecks.delete(organizationId);
      }
    }
  }

  private async ensureDefaultShiftAssignmentsInternal(organizationId: string) {
    // Reuse an existing 21:00–06:00 shift when available; otherwise create a
    // clearly labelled default shift for this organization.
    let shift = await this.prisma.shift.findFirst({
      where: { organizationId, startMinutes: 21 * 60, endMinutes: 6 * 60 },
      orderBy: { createdAt: 'asc' },
    });
    if (!shift) {
      try {
        shift = await this.prisma.shift.create({
          data: {
            organizationId,
            name: 'Default Night Shift',
            startMinutes: 21 * 60,
            endMinutes: 6 * 60,
          },
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        shift = await this.prisma.shift.findUniqueOrThrow({
          where: { organizationId_name: { organizationId, name: 'Default Night Shift' } },
        });
      }
    }

    const [organization, employees] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      }),
      this.prisma.employee.findMany({
        where: {
          organizationId,
          isActive: true,
          deviceUserId: { not: null },
          shiftAssignments: { none: {} },
        },
        select: { id: true },
      }),
    ]);
    const effectiveFrom = dateKeyToDatabaseDate(
      getDateKeyInTimeZone(new Date(), organization?.timezone || 'Asia/Karachi'),
    );
    if (employees.length) {
      await this.prisma.employeeShiftAssignment.createMany({
        data: employees.map((employee) => ({
          employeeId: employee.id,
          shiftId: shift.id,
          effectiveFrom,
        })),
      });
    }
  }

  async updateEmployeeStatus(
    user: CurrentUser,
    employeeId: string,
    isActive: boolean,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true },
    });

    if (!employee) {
      throw new ForbiddenException('Employee not found');
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const databaseNow = await this.prisma.databaseNow();

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        isActive,
        attendancePausedAt: isActive ? null : databaseNow,
        // Starting a new active period establishes a hard lower boundary for
        // raw-punch processing and payroll assessment. While paused, the
        // boundary is cleared and no attendance is monitored.
        attendanceTrackingSince: isActive ? databaseNow : null,
      },
      select: {
        id: true,
        employeeCode: true,
        deviceUserId: true,
        name: true,
        isActive: true,
      },
    });
  }

  async updateEmployeeSalary(
    user: CurrentUser,
    employeeId: string,
    monthlySalary?: number,
    allowance?: number,
  ) {
    if (monthlySalary === undefined && allowance === undefined) {
      throw new BadRequestException('Monthly salary or allowance is required');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true },
    });

    if (!employee) {
      throw new ForbiddenException('Employee not found');
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot update another organization');
    }

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(monthlySalary === undefined ? {} : { monthlySalary }),
        ...(allowance === undefined ? {} : { allowance }),
      },
      select: {
        id: true,
        employeeCode: true,
        deviceUserId: true,
        name: true,
        monthlySalary: true,
        allowance: true,
      },
    });

    return {
      ...updated,
      employeeCode: updated.deviceUserId ?? updated.employeeCode,
      monthlySalary: updated.monthlySalary.toString(),
      allowance: updated.allowance.toString(),
    };
  }

  private async getEmployeeForEarnings(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true, monthlySalary: true },
    });

    if (!employee) throw new BadRequestException('Employee not found');
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot access another organization');
    }
    return employee;
  }

  async listEmployeeEarnings(
    user: CurrentUser,
    employeeId: string,
    payrollCycleMonth?: string,
  ) {
    await this.getEmployeeForEarnings(user, employeeId);
    const earnings = await this.prisma.employeeEarning.findMany({
      where: {
        employeeId,
        ...(payrollCycleMonth ? { payrollCycleMonth } : {}),
      },
      orderBy: [{ payrollCycleMonth: 'desc' }, { createdAt: 'desc' }],
    });
    return earnings.map((earning) => ({
      ...earning,
      amount: earning.amount.toString(),
      percentage: earning.percentage?.toString() ?? null,
    }));
  }

  async createEmployeeEarning(
    user: CurrentUser,
    employeeId: string,
    dto: CreateEmployeeEarningDto,
  ) {
    const employee = await this.getEmployeeForEarnings(user, employeeId);
    const earning = await this.prisma.employeeEarning.create({
      data: {
        organizationId: employee.organizationId,
        employeeId,
        type: dto.type,
        amount: dto.amount,
        percentage: dto.percentage,
        payrollCycleMonth: dto.payrollCycleMonth,
        description: dto.description?.trim() || null,
        status: EmployeeEarningStatus.APPROVED,
      },
    });
    return {
      ...earning,
      amount: earning.amount.toString(),
      percentage: earning.percentage?.toString() ?? null,
    };
  }

  async updateEmployeeEarningStatus(
    user: CurrentUser,
    employeeId: string,
    earningId: string,
    dto: UpdateEmployeeEarningStatusDto,
  ) {
    await this.getEmployeeForEarnings(user, employeeId);
    const earning = await this.prisma.employeeEarning.findFirst({
      where: { id: earningId, employeeId },
    });
    if (!earning) throw new BadRequestException('Earning not found');
    const updated = await this.prisma.employeeEarning.update({
      where: { id: earningId },
      data: { status: dto.status },
    });
    return {
      ...updated,
      amount: updated.amount.toString(),
      percentage: updated.percentage?.toString() ?? null,
    };
  }

  async deleteEmployeeEarning(
    user: CurrentUser,
    employeeId: string,
    earningId: string,
  ) {
    await this.getEmployeeForEarnings(user, employeeId);
    const result = await this.prisma.employeeEarning.deleteMany({
      where: { id: earningId, employeeId },
    });
    if (!result.count) throw new BadRequestException('Earning not found');
    return { id: earningId, removed: true };
  }

  async listEmployeeLoans(user: CurrentUser, employeeId: string) {
    await this.getEmployeeForEarnings(user, employeeId);
    const loans = await this.prisma.employeeLoan.findMany({
      where: { employeeId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return loans.map((loan) => this.serializeLoan(loan));
  }

  async listAllEmployeeLoans(user: CurrentUser) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const loans = await this.prisma.employeeLoan.findMany({
      where:
        user.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: user.organizationId as string },
      include: {
        employee: {
          select: { id: true, employeeCode: true, deviceUserId: true, name: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return loans.map((loan) => ({
      ...this.serializeLoan(loan),
      employee: {
        id: loan.employee.id,
        employeeCode: loan.employee.deviceUserId ?? loan.employee.employeeCode,
        name: loan.employee.name,
      },
    }));
  }

  async createEmployeeLoan(
    user: CurrentUser,
    employeeId: string,
    dto: CreateEmployeeLoanDto,
  ) {
    const employee = await this.getEmployeeForEarnings(user, employeeId);
    const loan = await this.prisma.employeeLoan.create({
      data: {
        organizationId: employee.organizationId,
        employeeId,
        principalAmount: dto.principalAmount,
        monthlyInstallment: dto.monthlyInstallment,
        startCycleMonth: dto.startCycleMonth,
        numberOfInstallments: dto.numberOfInstallments,
        description: dto.description?.trim() || null,
      },
    });
    return this.serializeLoan(loan);
  }

  async updateEmployeeLoan(
    user: CurrentUser,
    employeeId: string,
    loanId: string,
    dto: UpdateEmployeeLoanDto,
  ) {
    await this.getEmployeeForEarnings(user, employeeId);
    const existing = await this.prisma.employeeLoan.findFirst({
      where: { id: loanId, employeeId },
    });
    if (!existing) throw new BadRequestException('Loan not found');

    const loan = await this.prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        ...(dto.principalAmount === undefined
          ? {}
          : { principalAmount: dto.principalAmount }),
        ...(dto.monthlyInstallment === undefined
          ? {}
          : { monthlyInstallment: dto.monthlyInstallment }),
        ...(dto.startCycleMonth === undefined
          ? {}
          : { startCycleMonth: dto.startCycleMonth }),
        ...(dto.numberOfInstallments === undefined
          ? {}
          : { numberOfInstallments: dto.numberOfInstallments }),
        ...(dto.description === undefined
          ? {}
          : { description: dto.description.trim() || null }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
      },
    });
    return this.serializeLoan(loan);
  }

  async deleteEmployeeLoan(
    user: CurrentUser,
    employeeId: string,
    loanId: string,
  ) {
    await this.getEmployeeForEarnings(user, employeeId);
    const result = await this.prisma.employeeLoan.deleteMany({
      where: { id: loanId, employeeId },
    });
    if (!result.count) throw new BadRequestException('Loan not found');
    return { id: loanId, removed: true };
  }

  private serializeLoan(loan: {
    id: string;
    employeeId: string;
    description: string | null;
    principalAmount: unknown;
    monthlyInstallment: unknown;
    startCycleMonth: string;
    numberOfInstallments: number;
    status: EmployeeLoanStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...loan,
      principalAmount: String(loan.principalAmount),
      monthlyInstallment: String(loan.monthlyInstallment),
    };
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async withTransientConnectionRetry<T>(operation: () => Promise<T>) {
    const delays = [250, 750];

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : '';
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code).toLowerCase()
            : '';
        const transientConnectionError =
          message.includes('connection timeout') ||
          message.includes('connection terminated') ||
          message.includes('connection reset') ||
          message.includes('statement timeout') ||
          message.includes('p2039') ||
          code === 'p1001' ||
          code === 'p1008' ||
          code === 'p1017' ||
          code === 'p2039';

        if (!transientConnectionError || attempt >= delays.length) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
