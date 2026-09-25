import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CorrectionStatus,
  Prisma,
  RequestKind,
  RequestStatus,
  UserRole,
} from '@prisma/client';

import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeRequestDto } from './dto/create-employee-request.dto';
import { RequestQueryDto } from './dto/request-query.dto';

type AttachmentMetadataRow = {
  id: string;
  request_id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: bigint | number | null;
};

type AttachmentRow = {
  original_name: string;
  mime_type: string | null;
  content: Buffer | Uint8Array;
};

type RequestAttachmentView = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  size: number;
};

@Injectable()
export class RequestsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RequestsService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.cleanupExpiredRequests();
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpiredRequests(),
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async list(user: CurrentUser, query: RequestQueryDto) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const organizationWhere =
      user.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: user.organizationId as string };

    const records = await this.prisma.employeeRequest.findMany({
      where: {
        ...organizationWhere,
        ...(query.status ? { status: query.status as RequestStatus } : {}),
      },
      include: {
        employee: { select: { employeeCode: true, deviceUserId: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
    });

    const corrections =
      query.status === RequestStatus.CANCELLED
        ? []
        : await this.prisma.attendanceCorrection.findMany({
            where: {
              ...organizationWhere,
              ...(query.status
                ? { status: query.status as CorrectionStatus }
                : {}),
            },
            include: {
              employee: {
                select: {
                  employeeCode: true,
                  deviceUserId: true,
                  name: true,
                },
              },
              dailyAttendance: { select: { date: true } },
            },
            orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
          });

    const attachmentMap = await this.listAttachments([
      ...records.map((record) => record.id),
      ...corrections.map((correction) => correction.id),
    ]);

    const employeeRequests = records.map((record) => ({
      id: record.id,
      source: 'EMPLOYEE_REQUEST' as const,
      employeeId: record.employeeId,
      employeeCode: record.employee.deviceUserId ?? record.employee.employeeCode,
      employee: record.employee.name,
      kind: record.kind,
      complaintType: null,
      expectedCheckIn: null,
      expectedCheckOut: null,
      leaveCategory: record.leaveCategory,
      fromDate: record.fromDate.toISOString().slice(0, 10),
      toDate: record.toDate.toISOString().slice(0, 10),
      reason: record.reason,
      note: record.note,
      attachments: attachmentMap.get(record.id) ?? [],
      status: record.status,
      submittedAt: record.submittedAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      decidedAt: record.decidedAt?.toISOString() ?? null,
    }));

    const correctionRequests = corrections.map((correction) => {
      const attendanceDate =
        correction.dailyAttendance?.date ?? correction.submittedAt;

      return {
        id: correction.id,
        source: 'ATTENDANCE_CORRECTION' as const,
        employeeId: correction.employeeId,
        employeeCode:
          correction.employee.deviceUserId ?? correction.employee.employeeCode,
        employee: correction.employee.name,
        kind: RequestKind.CORRECTION,
        complaintType: correction.complaintType,
        expectedCheckIn: this.formatTime(correction.expectedCheckIn),
        expectedCheckOut: this.formatTime(correction.expectedCheckOut),
        leaveCategory: null,
        fromDate: attendanceDate.toISOString().slice(0, 10),
        toDate: attendanceDate.toISOString().slice(0, 10),
        reason: correction.description,
        note: null,
        attachments: attachmentMap.get(correction.id) ?? [],
        status: correction.status,
        submittedAt: correction.submittedAt.toISOString(),
        updatedAt: correction.updatedAt.toISOString(),
        decidedAt: correction.decidedAt?.toISOString() ?? null,
      };
    });

    const statusOrder = { PENDING: 0, APPROVED: 1, REJECTED: 2, CANCELLED: 3 };
    return [...employeeRequests, ...correctionRequests].sort(
      (left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        right.submittedAt.localeCompare(left.submittedAt),
    );
  }

  async getAttachment(
    user: CurrentUser,
    requestId: string,
    attachmentId: string,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const rows =
      user.role === UserRole.SUPER_ADMIN
        ? await this.prisma.$queryRaw<AttachmentRow[]>`
            SELECT original_name, mime_type, content
            FROM request_attachments
            WHERE id = ${attachmentId}::uuid
              AND request_id = ${requestId}::uuid
            LIMIT 1
          `
        : await this.prisma.$queryRaw<AttachmentRow[]>`
            SELECT original_name, mime_type, content
            FROM request_attachments
            WHERE id = ${attachmentId}::uuid
              AND request_id = ${requestId}::uuid
              AND organization_id = ${user.organizationId as string}::uuid
            LIMIT 1
          `;

    const attachment = rows[0];
    if (!attachment) throw new NotFoundException('Attachment not found');
    return {
      originalName: attachment.original_name,
      mimeType: attachment.mime_type || 'application/octet-stream',
      content: Buffer.from(attachment.content),
    };
  }

  private async listAttachments(requestIds: string[]) {
    const attachmentsByRequest = new Map<string, RequestAttachmentView[]>();
    if (!requestIds.length) return attachmentsByRequest;

    const rows = await this.prisma.$queryRaw<AttachmentMetadataRow[]>`
      SELECT id, request_id, original_name, mime_type, size_bytes
      FROM request_attachments
      WHERE request_id IN (${Prisma.join(requestIds)})
      ORDER BY uploaded_at ASC
    `;

    for (const row of rows) {
      const attachment = {
        id: row.id,
        name: row.original_name,
        url: `/requests/${row.request_id}/attachments/${row.id}`,
        mimeType: row.mime_type,
        size: Number(row.size_bytes ?? 0),
      };
      const existing = attachmentsByRequest.get(row.request_id) ?? [];
      existing.push(attachment);
      attachmentsByRequest.set(row.request_id, existing);
    }
    return attachmentsByRequest;
  }

  async create(user: CurrentUser, dto: CreateEmployeeRequestDto) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const employeeId =
      user.role === UserRole.EMPLOYEE ? user.employeeId : dto.employeeId;
    if (!employeeId) {
      throw new BadRequestException('employeeId is required');
    }
    const fromDate = this.parseDate(dto.fromDate);
    const toDate = this.parseDate(dto.toDate);
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true, isActive: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.isActive) {
      throw new BadRequestException('Cannot create a request for an inactive employee');
    }
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      employee.organizationId !== user.organizationId
    ) {
      throw new ForbiddenException('Cannot create a request for another organization');
    }
    if (dto.kind === RequestKind.LEAVE && !dto.leaveCategory) {
      throw new BadRequestException('leaveCategory is required for leave requests');
    }

    const record = await this.prisma.employeeRequest.create({
      data: {
        organizationId: employee.organizationId,
        employeeId: employee.id,
        kind: dto.kind as RequestKind,
        leaveCategory: dto.kind === RequestKind.LEAVE ? dto.leaveCategory : null,
        fromDate,
        toDate,
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
        status: RequestStatus.PENDING,
      },
      select: { id: true, status: true },
    });

    return { id: record.id, status: record.status };
  }

  async updateStatus(
    user: CurrentUser,
    id: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ORG_ADMIN &&
      user.role !== UserRole.HR_MANAGER
    ) {
      throw new ForbiddenException('Only managers can review requests');
    }
    if (user.role !== UserRole.SUPER_ADMIN && !user.organizationId) {
      throw new ForbiddenException('User is not assigned to an organization');
    }

    const organizationWhere =
      user.role === UserRole.SUPER_ADMIN
        ? {}
        : { organizationId: user.organizationId as string };
    const existing = await this.prisma.employeeRequest.findFirst({
      where: {
        id,
        ...organizationWhere,
      },
      select: { id: true, status: true, decidedAt: true },
    });

    // The local isolated environment uses a synthetic admin identity that is
    // not stored in the users table. Keep the reviewer column nullable there
    // so the existing foreign key cannot reject an otherwise valid decision.
    const reviewer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });

    if (existing) {
      if (existing.status === status) {
        return {
          id: existing.id,
          status: existing.status,
          decidedAt: existing.decidedAt?.toISOString() ?? null,
        };
      }

      const isPending = status === 'PENDING';
      const updated = await this.prisma.employeeRequest.update({
        where: { id },
        data: {
          status: status as RequestStatus,
          decidedAt: isPending ? null : new Date(),
          decidedBy: isPending ? null : (reviewer?.id ?? null),
        },
        select: { id: true, status: true, decidedAt: true },
      });

      return {
        id: updated.id,
        status: updated.status,
        decidedAt: updated.decidedAt?.toISOString() ?? null,
      };
    }

    const correction = await this.prisma.attendanceCorrection.findFirst({
      where: { id, ...organizationWhere },
      select: { id: true, status: true, decidedAt: true },
    });
    if (!correction) throw new NotFoundException('Request not found');
    if (correction.status === status) {
      return {
        id: correction.id,
        status: correction.status,
        decidedAt: correction.decidedAt?.toISOString() ?? null,
      };
    }

    const isPending = status === 'PENDING';
    const updated = await this.prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status: status as CorrectionStatus,
        decidedAt: isPending ? null : new Date(),
        decidedBy: isPending ? null : (reviewer?.id ?? null),
      },
      select: { id: true, status: true, decidedAt: true },
    });

    return {
      id: updated.id,
      status: updated.status,
      decidedAt: updated.decidedAt?.toISOString() ?? null,
    };
  }

  private async cleanupExpiredRequests() {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    try {
      const [employeeRequests, corrections] = await Promise.all([
        this.prisma.employeeRequest.deleteMany({
          where: {
            status: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
            OR: [
              { decidedAt: { lte: cutoff } },
              { decidedAt: null, updatedAt: { lte: cutoff } },
            ],
          },
        }),
        this.prisma.attendanceCorrection.deleteMany({
          where: {
            status: {
              in: [CorrectionStatus.APPROVED, CorrectionStatus.REJECTED],
            },
            OR: [
              { decidedAt: { lte: cutoff } },
              { decidedAt: null, updatedAt: { lte: cutoff } },
            ],
          },
        }),
      ]);
      const deleted = employeeRequests.count + corrections.count;
      if (deleted > 0) {
        this.logger.log(
          `Deleted ${deleted} request(s) reviewed more than two days ago`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Could not clean up expired reviewed requests',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private parseDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Dates must use YYYY-MM-DD');
    }
    return date;
  }

  private formatTime(value: Date | null) {
    return value ? value.toISOString().slice(11, 16) : null;
  }
}
