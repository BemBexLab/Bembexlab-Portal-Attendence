import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseService } from './database.service';

@Module({
  imports: [PrismaModule],
  providers: [DatabaseService],
  exports: [PrismaModule, DatabaseService],
})
export class DatabaseModule {}
