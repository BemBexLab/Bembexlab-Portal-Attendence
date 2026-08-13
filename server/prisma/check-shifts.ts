import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

prisma.shift
  .count()
  .then((count) => console.log(JSON.stringify({ shiftsTable: true, count })))
  .catch((error: { code?: string; message?: string }) =>
    console.log(
      JSON.stringify({
        shiftsTable: false,
        code: error.code,
        message: error.message,
      }),
    ),
  )
  .finally(() => prisma.$disconnect());
