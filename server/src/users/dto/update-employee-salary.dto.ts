import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateEmployeeSalaryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  monthlySalary!: number;
}
