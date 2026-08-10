import { VerificationType } from '@prisma/client';

export type ZktecoConnectionTarget = {
  ip: string;
  port: number;
};

export type ZktecoDeviceInfo = {
  userCounts?: unknown;
  logCounts?: unknown;
  logCapacity?: unknown;
  [key: string]: unknown;
};

export type ZktecoRawAttendanceRecord = {
  userSn?: unknown;
  deviceUserId?: unknown;
  recordTime?: unknown;
  ip?: unknown;
};

export type NormalizedAttendancePunch = {
  deviceUserId: string;
  punchTime: Date;
  verificationType: VerificationType;
  raw: ZktecoRawAttendanceRecord;
};
