import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateShiftDto {
  @IsString() @MinLength(2) name!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1439) startMinutes!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1439) endMinutes!: number;
  @IsOptional() @IsUUID() organizationId?: string;
}

export class UpdateShiftDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinutes?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AssignEmployeeShiftDto {
  @IsUUID() shiftId!: string;
  @IsDateString() effectiveFrom!: string;
}
