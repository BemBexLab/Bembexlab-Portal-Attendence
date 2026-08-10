import {
  IsEnum,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { DeviceStatus } from '@prisma/client';

export class CreateDeviceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIP()
  ip!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;
}
