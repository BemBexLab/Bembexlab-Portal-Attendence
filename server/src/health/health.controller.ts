import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const checks = {
      api: 'ok',
      database: await this.checkDatabase(),
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

}
