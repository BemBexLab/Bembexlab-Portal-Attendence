import { EmployeeEarningType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateEmployeeEarningDto {
  @IsOptional()
  @IsEnum(EmployeeEarningType)
  type?: EmployeeEarningType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  payrollCycleMonth?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
