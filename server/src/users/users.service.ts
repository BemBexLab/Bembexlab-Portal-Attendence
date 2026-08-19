import { ForbiddenException, Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../auth/types/current-user.type';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
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

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        deviceUserId: { not: null },
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

    return employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.deviceUserId ?? employee.employeeCode,
      name: employee.name,
      department: employee.department?.name ?? null,
      deviceUserId: employee.deviceUserId,
      isActive: employee.isActive,
      monthlySalary: employee.monthlySalary.toString(),
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

    const databaseNow = isActive ? await this.prisma.databaseNow() : null;

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        isActive,
        attendanceTrackingSince: databaseNow,
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
    monthlySalary: number,
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

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { monthlySalary },
      select: {
        id: true,
        employeeCode: true,
        deviceUserId: true,
        name: true,
        monthlySalary: true,
      },
    });

    return {
      ...updated,
      employeeCode: updated.deviceUserId ?? updated.employeeCode,
      monthlySalary: updated.monthlySalary.toString(),
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
}
