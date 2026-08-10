import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { createRedisConnectionConfig } from '../config/redis-connection';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly connectionLabel: string;
  private hasLoggedConnectionError = false;

  constructor(configService: ConfigService) {
    const connection = createRedisConnectionConfig({
      REDIS_URL: configService.get<string>('REDIS_URL'),
      REDIS_HOST: configService.get<string>('REDIS_HOST'),
      REDIS_PORT: configService.get<number>('REDIS_PORT'),
    });

    this.connectionLabel = connection.label;
    this.client = new Redis({
      ...connection.options,
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 250, 3000),
    });

    this.client.on('ready', () => {
      this.hasLoggedConnectionError = false;
      this.logger.log(`Redis connection ready at ${this.connectionLabel}`);
    });

    this.client.on('error', (error) => {
      if (this.hasLoggedConnectionError) {
        return;
      }

      this.hasLoggedConnectionError = true;
      this.logger.error(
        `Redis connection error at ${this.connectionLabel}: ${error.message}`,
      );
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.client.disconnect();

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to connect to Redis at ${this.connectionLabel}. Start Redis or update REDIS_URL or REDIS_HOST/REDIS_PORT. ${message}`,
      );
    }
  }

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
