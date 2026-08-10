import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  async checkConnection() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
    };
  }
}
