import type { UserRole } from "./auth";

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "MISSING_CHECKOUT"
  | "ON_LEAVE"
  | "HOLIDAY";

export type DeviceStatus = "ACTIVE" | "INACTIVE" | "OFFLINE" | "MAINTENANCE";

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

export type RealtimeConnectionPayload = {
  socketId: string;
  role?: UserRole;
};

export type RealtimeEvent =
  | {
      type: "attendance.updated";
      payload: AttendanceUpdatedPayload;
      receivedAt: string;
    }
  | {
      type: "device.connected" | "device.disconnected";
      payload: DeviceConnectionPayload;
      receivedAt: string;
    };
