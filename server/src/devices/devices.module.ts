import { Module } from '@nestjs/common';

import { AttendanceModule } from '../attendance/attendance.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ZKTecoModule } from '../zkteco/zkteco.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [AttendanceModule, PrismaModule, ZKTecoModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
