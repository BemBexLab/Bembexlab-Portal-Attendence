import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { dateKeyToDatabaseDate } from '../attendance/utils/timezone';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AssignEmployeeShiftDto,
  CreateShiftDto,
  UpdateShiftDto,
} from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: CurrentUser) {
    return this.prisma.shift.findMany({
      where: this.scope(user),
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(user: CurrentUser, dto: CreateShiftDto) {
    if (dto.startMinutes === dto.endMinutes)
      throw new BadRequestException('Shift start and end must differ');
    const organizationId = this.organizationId(user, dto.organizationId);
    try {
      return await this.prisma.shift.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          startMinutes: dto.startMinutes,
          endMinutes: dto.endMinutes,
        },
      });
    } catch (error) {
      if (this.unique(error))
        throw new ConflictException('A shift with this name already exists');
      throw error;
    }
  }

  async update(user: CurrentUser, id: string, dto: UpdateShiftDto) {
    const shift = await this.get(user, id);
    const start = dto.startMinutes ?? shift.startMinutes;
    const end = dto.endMinutes ?? shift.endMinutes;
    if (start === end)
      throw new BadRequestException('Shift start and end must differ');
    return this.prisma.shift.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
    });
  }

  async remove(user: CurrentUser, id: string) {
    await this.get(user, id);
    return this.prisma.$transaction(async (tx) => {
      const assignments = await tx.employeeShiftAssignment.deleteMany({
        where: { shiftId: id },
      });
      await tx.shift.delete({ where: { id } });
      return { id, removedAssignments: assignments.count };
    });
  }

  async assign(
    user: CurrentUser,
    employeeId: string,
    dto: AssignEmployeeShiftDto,
  ) {
    const [employee, shift] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: employeeId, ...this.scope(user) },
      }),
      this.prisma.shift.findFirst({
        where: { id: dto.shiftId, ...this.scope(user), isActive: true },
      }),
    ]);
    if (!employee || !shift || employee.organizationId !== shift.organizationId)
      throw new NotFoundException('Employee or shift not found');
    const effectiveFrom = dateKeyToDatabaseDate(dto.effectiveFrom);
    return this.prisma.$transaction(async (tx) => {
      await tx.employeeShiftAssignment.updateMany({
        where: {
          employeeId,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
        },
        data: { effectiveTo: new Date(effectiveFrom.getTime() - 86_400_000) },
      });
      await tx.employeeShiftAssignment.deleteMany({
        where: { employeeId, effectiveFrom: { gte: effectiveFrom } },
      });
      return tx.employeeShiftAssignment.create({
        data: { employeeId, shiftId: shift.id, effectiveFrom },
        include: { shift: true },
      });
    });
  }

  private get(user: CurrentUser, id: string) {
    return this.prisma.shift.findFirstOrThrow({
      where: { id, ...this.scope(user) },
    });
  }
  private scope(user: CurrentUser) {
    if (user.role === UserRole.SUPER_ADMIN) return {};
    if (!user.organizationId)
      throw new ForbiddenException('User is not assigned to an organization');
    return { organizationId: user.organizationId };
  }
  private organizationId(user: CurrentUser, requested?: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!requested)
        throw new BadRequestException('organizationId is required');
      return requested;
    }
    if (
      !user.organizationId ||
      (requested && requested !== user.organizationId)
    )
      throw new ForbiddenException('Cannot access another organization');
    return user.organizationId;
  }
  private unique(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
