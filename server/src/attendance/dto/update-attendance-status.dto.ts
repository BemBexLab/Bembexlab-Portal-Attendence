import { AttendanceStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

const MANUAL_ATTENDANCE_STATUSES = [
  AttendanceStatus.ABSENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.REMOTE,
  AttendanceStatus.ON_LEAVE,
  AttendanceStatus.HOLIDAY,
] as const;

export class UpdateAttendanceStatusDto {
  @IsIn(MANUAL_ATTENDANCE_STATUSES)
  status!: (typeof MANUAL_ATTENDANCE_STATUSES)[number];
}
