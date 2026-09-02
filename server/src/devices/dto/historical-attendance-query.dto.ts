import { IsDateString, IsOptional, IsString } from 'class-validator';

export class HistoricalAttendanceQueryDto {
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
