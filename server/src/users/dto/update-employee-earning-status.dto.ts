import { EmployeeEarningStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEmployeeEarningStatusDto {
  @IsEnum(EmployeeEarningStatus)
  status!: EmployeeEarningStatus;
}
