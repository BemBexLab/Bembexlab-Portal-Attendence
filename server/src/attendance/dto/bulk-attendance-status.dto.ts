import { AttendanceStatus } from '@prisma/client';
import { IsIn, IsUUID, Matches } from 'class-validator';

const BULK_STATUSES = [
  AttendanceStatus.REMOTE,
  AttendanceStatus.ON_LEAVE,
] as const;

export class BulkAttendanceStatusDto {
  @IsUUID()
  employeeId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @IsIn(BULK_STATUSES)
  status!: (typeof BULK_STATUSES)[number];
}
