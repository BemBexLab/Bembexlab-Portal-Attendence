import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ZKTecoModule } from '../zkteco/zkteco.module';
import { AttendanceProcessingService } from './attendance-processing.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceProcessor } from './processors/attendance.processor';

@Module({
  imports: [PrismaModule, QueueModule, WebsocketModule, ZKTecoModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceProcessingService, AttendanceProcessor],
  exports: [AttendanceProcessingService],
})
export class AttendanceModule {}
