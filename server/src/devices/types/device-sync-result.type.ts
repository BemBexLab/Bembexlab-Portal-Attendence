export type DeviceSyncResult = {
  fetched: number;
  stored: number;
  duplicates: number;
  unmatched: number;
  skipped: number;
  dailyCalculated: number;
  error?: string;
};
