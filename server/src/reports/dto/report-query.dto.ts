import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class OrganizationScopedQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class DailyReportQueryDto extends OrganizationScopedQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class DateRangeReportQueryDto extends OrganizationScopedQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class MonthlyReportQueryDto extends OrganizationScopedQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

export class LateArrivalsReportQueryDto extends DateRangeReportQueryDto {
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  threshold?: string;
}

export class OvertimeReportQueryDto extends DateRangeReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumMinutes?: number;
}

export class AllRawPunchesQueryDto extends OrganizationScopedQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RawPunchesQueryDto extends AllRawPunchesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
