import 'dotenv/config';
import bcrypt from 'bcrypt';
import { DeviceStatus, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

async function main() {
  const organizationName =
    process.env.SEED_ORGANIZATION_NAME || 'Bembex Demo Organization';
  const timezone = process.env.ATTENDANCE_DEFAULT_TIMEZONE || 'UTC';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminName = process.env.SEED_ADMIN_NAME || 'Organization Admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const employeeCode = process.env.SEED_EMPLOYEE_CODE || 'EMP-001';
  const employeeName = process.env.SEED_EMPLOYEE_NAME || 'Sample Employee';
  const employeeDeviceUserId = process.env.SEED_EMPLOYEE_DEVICE_USER_ID || '1';
  const deviceName = process.env.SEED_DEVICE_NAME || 'K40 Main Gate';
  const deviceIp = process.env.SEED_DEVICE_IP || '192.168.10.197';
  const devicePort = Number(process.env.SEED_DEVICE_PORT || 4370);

  const organization =
    (await prisma.organization.findFirst({
      where: {
        name: organizationName,
      },
    })) ||
    (await prisma.organization.create({
      data: {
        name: organizationName,
        timezone,
      },
    }));

  await prisma.organization.update({
    where: { id: organization.id },
    data: { timezone },
  });

  const department = await prisma.department.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'General',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'General',
    },
  });

  await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {
      name: adminName,
      organizationId: organization.id,
      role: UserRole.ORG_ADMIN,
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ORG_ADMIN,
      organizationId: organization.id,
    },
  });

  await prisma.employee.upsert({
    where: {
      organizationId_employeeCode: {
        organizationId: organization.id,
        employeeCode,
      },
    },
    update: {
      name: employeeName,
      departmentId: department.id,
      deviceUserId: employeeDeviceUserId,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      departmentId: department.id,
      employeeCode,
      name: employeeName,
      deviceUserId: employeeDeviceUserId,
    },
  });

  await prisma.zktecoDevice.upsert({
    where: {
      organizationId_ip_port: {
        organizationId: organization.id,
        ip: deviceIp,
        port: devicePort,
      },
    },
    update: {
      name: deviceName,
      status: DeviceStatus.ACTIVE,
    },
    create: {
      organizationId: organization.id,
      name: deviceName,
      ip: deviceIp,
      port: devicePort,
      status: DeviceStatus.ACTIVE,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
