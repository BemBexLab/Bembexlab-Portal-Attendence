import { IsIP, IsInt, Max, Min } from 'class-validator';

export class TestDeviceDto {
  @IsIP()
  ip!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;
}
