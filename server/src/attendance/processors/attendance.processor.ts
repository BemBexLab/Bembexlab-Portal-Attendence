import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import { QueueService } from '../../queue/queue.service';
import { AttendanceProcessingService } from '../attendance-processing.service';
import {
  ATTENDANCE_QUEUE_NAME,
  SYNC_ALL_DEVICES_JOB,
} from '../types/attendance-processing.types';

@Injectable()
export class AttendanceProcessor implements OnModuleInit {
  private readonly logger = new Logger(AttendanceProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly attendanceProcessingService: AttendanceProcessingService,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get<string>(
      'ATTENDANCE_SYNC_ENABLED',
      'true',
    );

    if (enabled === 'false') {
      this.logger.warn('Attendance sync worker is disabled');
      return;
    }

    const queue = this.queueService.createQueue(ATTENDANCE_QUEUE_NAME);

    await this.attendanceProcessingService.enforceTwoMonthRetention();

    this.queueService.createWorker(ATTENDANCE_QUEUE_NAME, (job) =>
      this.process(job),
    );

    const every = Number(
      this.configService.get<string>('ATTENDANCE_SYNC_EVERY_MS', '300000'),
    );

    // Clear a scheduler created with a different repeat strategy (for example,
    // a previous cron schedule) so its old next-run timestamp is not retained.
    await queue.removeJobScheduler(SYNC_ALL_DEVICES_JOB);
    await queue.upsertJobScheduler(
      SYNC_ALL_DEVICES_JOB,
      {
        every: Number.isInteger(every) && every > 0 ? every : 300_000,
      },
      {
        name: SYNC_ALL_DEVICES_JOB,
        data: {},
      },
    );

    this.logger.log(`Attendance sync worker scheduled every ${every}ms`);
  }

  private async process(job: Job) {
    if (job.name !== SYNC_ALL_DEVICES_JOB) {
      this.logger.warn(`Unknown attendance job ignored: ${job.name}`);
      return;
    }

    const result =
      await this.attendanceProcessingService.processAllActiveDevices();
    this.logger.log(
      `Attendance sync complete: ${result.processedDevices} devices, ${result.stored} raw logs stored, ${result.dailyCalculated} daily rows calculated`,
    );

    return result;
  }
}
