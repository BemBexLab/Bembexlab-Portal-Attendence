import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

import { createRedisConnectionConfig } from '../config/redis-connection';

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;

export function createQueueConnectionOptions(
  configService: ConfigService,
): RedisOptions {
  const connection = createRedisConnectionConfig({
    REDIS_URL: configService.get<string>('REDIS_URL'),
    REDIS_HOST: configService.get<string>('REDIS_HOST'),
    REDIS_PORT: configService.get<number>('REDIS_PORT'),
  });

  return {
    ...connection.options,
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 250, 3000),
  };
}
