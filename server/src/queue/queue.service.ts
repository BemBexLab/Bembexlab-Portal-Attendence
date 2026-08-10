import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Queue,
  Worker,
  type Processor,
  type QueueOptions,
  type WorkerOptions,
} from 'bullmq';
import type { RedisOptions } from 'ioredis';

import {
  DEFAULT_JOB_OPTIONS,
  createQueueConnectionOptions,
} from './queue.config';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: RedisOptions;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();

  constructor(configService: ConfigService) {
    this.connection = createQueueConnectionOptions(configService);
  }

  getConnectionOptions(): RedisOptions {
    return { ...this.connection };
  }

  createQueue(name: string, options: Omit<QueueOptions, 'connection'> = {}) {
    const queue = new Queue(name, {
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
      ...options,
      connection: this.connection,
    });

    queue.on('error', (error) => {
      this.logger.error(`Queue "${name}" error: ${error.message}`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  createWorker(
    name: string,
    processor: Processor,
    options: Omit<WorkerOptions, 'connection'> = {},
  ) {
    const worker = new Worker(name, processor, {
      ...options,
      connection: this.connection,
    });

    worker.on('error', (error) => {
      this.logger.error(`Worker "${name}" error: ${error.message}`);
    });

    this.workers.set(name, worker);
    return worker;
  }

  async onModuleDestroy() {
    await Promise.all([
      ...Array.from(this.workers.values()).map((worker) => worker.close()),
      ...Array.from(this.queues.values()).map((queue) => queue.close()),
    ]);
  }
}
