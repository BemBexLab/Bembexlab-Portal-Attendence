import { AttendanceStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

const MANUAL_ATTENDANCE_STATUSES = [
  AttendanceStatus.MISSING_CHECKOUT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.REMOTE,
] as const;

export class UpdateAttendanceStatusDto {
  @IsIn(MANUAL_ATTENDANCE_STATUSES)
  status!: (typeof MANUAL_ATTENDANCE_STATUSES)[number];
}
