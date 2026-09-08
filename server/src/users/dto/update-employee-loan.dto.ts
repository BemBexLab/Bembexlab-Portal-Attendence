import { EmployeeLoanStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateEmployeeLoanDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  principalAmount?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  monthlyInstallment?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  startCycleMonth?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(1200)
  numberOfInstallments?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EmployeeLoanStatus)
  status?: EmployeeLoanStatus;
}
