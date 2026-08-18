export const ATTENDANCE_QUEUE_NAME = 'attendance-processing';
export const SYNC_ALL_DEVICES_JOB = 'sync-all-devices';

export type ProcessedDeviceResult = {
  deviceId: string;
  organizationId: string;
  deviceUserIds: string[];
  fetched: number;
  stored: number;
  duplicates: number;
  unmatched: number;
  dailyCalculated: number;
};

export type AttendanceProcessingResult = {
  processedDevices: number;
  offlineDevices: number;
  fetched: number;
  stored: number;
  duplicates: number;
  unmatched: number;
  dailyCalculated: number;
  devices: ProcessedDeviceResult[];
};
