import { AttendanceStatus, DeviceStatus } from '@prisma/client';

export const REALTIME_EVENTS = {
  ATTENDANCE_UPDATED: 'attendance.updated',
  DEVICE_CONNECTED: 'device.connected',
  DEVICE_DISCONNECTED: 'device.disconnected',
} as const;

export type AttendanceUpdatedPayload = {
  organizationId: string;
  deviceId: string;
  fetched: number;
  stored: number;
  duplicates: number;
  unmatched: number;
  dailyCalculated: number;
  dailyAttendance: Array<{
    employeeId: string;
    date: string;
    firstCheckIn: string | null;
    lastCheckOut: string | null;
    workingMinutes: number;
    status: AttendanceStatus;
  }>;
  emittedAt: string;
};

export type DeviceConnectionPayload = {
  organizationId: string;
  deviceId: string;
  ip: string;
  port: number;
  status: DeviceStatus;
  emittedAt: string;
};
