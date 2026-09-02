import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const REQUEST_KINDS = ['LEAVE', 'REMOTE_WORK'] as const;
const LEAVE_CATEGORIES = [
  'ANNUAL_LEAVE',
  'SICK_LEAVE',
  'CASUAL_LEAVE',
  'UNPAID_LEAVE',
] as const;

export class CreateEmployeeRequestDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsIn(REQUEST_KINDS)
  kind!: (typeof REQUEST_KINDS)[number];

  @IsOptional()
  @IsIn(LEAVE_CATEGORIES)
  leaveCategory?: (typeof LEAVE_CATEGORIES)[number];

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
