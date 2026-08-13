import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ShiftsModule } from './shifts/shifts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    WebsocketModule,
    ShiftsModule,
    UsersModule,
    AuthModule,
    DevicesModule,
    AttendanceModule,
    ReportsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
