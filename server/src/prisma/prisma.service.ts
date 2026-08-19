import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const configuredUrl = configService.getOrThrow<string>('DATABASE_URL');
    const databaseUrl = new URL(configuredUrl);
    databaseUrl.searchParams.delete('connection_limit');
    databaseUrl.searchParams.delete('pgbouncer');
    const adapter = new PrismaPg({
      connectionString: databaseUrl.toString(),
      // Keep the application pool small because Supabase pooler capacity is
      // shared with background attendance synchronization and reports.
      max: 5,
      min: 1,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 60_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });

    super({
      adapter,
      transactionOptions: {
        maxWait: 15_000,
        timeout: 60_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async databaseNow() {
    const [row] = await this.$queryRaw<Array<{ now: Date }>>`
      SELECT CURRENT_TIMESTAMP AS "now"
    `;

    if (!row?.now) {
      throw new Error('Database did not return its current timestamp');
    }

    return row.now;
  }
}
