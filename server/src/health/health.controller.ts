import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = {
      api: 'ok',
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };
    const healthy = Object.values(checks).every((status) => status === 'ok');

    if (!healthy) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis() {
    try {
      const result = await this.redis.getClient().ping();
      return result === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
