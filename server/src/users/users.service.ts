import { ForbiddenException, Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../auth/types/current-user.type';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
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
        ...(user.role === UserRole.SUPER_ADMIN
          ? {}
          : { organizationId: user.organizationId as string }),
        ...(user.role === UserRole.EMPLOYEE
          ? { id: user.employeeId as string }
          : {}),
      },
      include: {
        department: true,
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });

    return employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      department: employee.department?.name ?? null,
      deviceUserId: employee.deviceUserId,
      isActive: employee.isActive,
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
        name: true,
        isActive: true,
      },
    });
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
}
