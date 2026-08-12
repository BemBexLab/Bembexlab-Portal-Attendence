export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "MISSING_CHECKOUT"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "REMOTE";

export type DeviceStatus = "ACTIVE" | "OFFLINE" | "MAINTENANCE" | "INACTIVE";

export type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  deviceUserId: string | null;
  isActive: boolean;
  monthlySalary: string;
};

export type PayrollRow = {
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  monthlySalary: number;
  workingDays: number;
  assessedWorkingDays: number;
  dailyRate: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  halfDayDeductionDays: number;
  totalDeductionDays: number;
  deductionAmount: number;
  payableSalary: number;
  attendanceDetails: Array<{
    date: string;
    day: string;
    status: "ABSENT" | "HALF_DAY";
  }>;
};

export type PayrollReport = {
  month: string;
  cycleStart: string;
  cycleEnd: string;
  calculatedThrough: string | null;
  workingDays: number;
  rule: string;
  summary: {
    employees: number;
    grossSalary: number;
    deductions: number;
    payableSalary: number;
  };
  rows: PayrollRow[];
};

export type AttendanceRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  date: string;
  employee: string;
  department: string;
  arrival: string | null;
  exit: string | null;
  workingMinutes: number;
  status: AttendanceStatus;
};

export type ScheduledAttendanceStatus = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  date: string;
  status: "REMOTE" | "ON_LEAVE";
};

export type RawPunch = {
  id: string;
  employeeCode: string;
  employee: string;
  department: string;
  device: string;
  punchTime: string;
  verificationType: string;
};

export type Device = {
  id: string;
  name: string;
  ip: string;
  port: number;
  status: DeviceStatus;
  lastSync: string | null;
};

export type DeviceInfoResponse = {
  deviceId: string;
  info: Record<string, unknown>;
};

export type DeviceSyncResult = {
  fetched: number;
  stored: number;
  duplicates: number;
  unmatched: number;
  skipped: number;
  dailyCalculated: number;
  error?: string;
};

export type DashboardSummary = {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  activeDevices: number;
  offlineDevices: number;
};

export type DepartmentAttendance = {
  department: string;
  present: number;
  absent: number;
  late: number;
};

export type AttendanceTrend = {
  day: string;
  present: number;
  absent: number;
};

export type DailyReportRow = {
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  organization: string;
  date: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workingMinutes: number;
  status: AttendanceStatus;
};

export type DailyReport = {
  date: string;
  summary: {
    totalEmployees: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    missingCheckoutCount: number;
    totalWorkingMinutes: number;
  };
  rows: DailyReportRow[];
};

export type AttendanceExportReport = {
  from: string;
  to: string;
  rows: DailyReportRow[];
};

export type MonthlyReportRow = {
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  organization: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  missingCheckoutDays: number;
  totalWorkingMinutes: number;
  overtimeMinutes: number;
};

export type MonthlyReport = {
  month: string;
  summary: {
    employees: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    overtimeMinutes: number;
  };
  rows: MonthlyReportRow[];
};

export type LateArrivalRow = {
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  organization: string;
  date: string;
  arrival: string;
  threshold: string;
  minutesLate: number;
  status: AttendanceStatus;
};

export type LateArrivalsReport = {
  from: string;
  to: string;
  threshold: string;
  summary: {
    count: number;
    averageMinutesLate: number;
  };
  rows: LateArrivalRow[];
};

export type OvertimeRow = {
  employeeId: string;
  employeeCode: string;
  employee: string;
  department: string;
  organization: string;
  date: string;
  workingMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
};

export type OvertimeReport = {
  from: string;
  to: string;
  minimumMinutes: number;
  summary: {
    count: number;
    overtimeMinutes: number;
  };
  rows: OvertimeRow[];
};

export type ReportTrend = {
  date: string;
  present: number;
  absent: number;
  late: number;
  overtimeHours: number;
  averageWorkingHours: number;
  totalWorkingMinutes: number;
  rows: number;
};

export type ReportDepartmentStatistic = {
  department: string;
  present: number;
  absent: number;
  late: number;
  overtimeHours: number;
  averageWorkingHours: number;
  totalWorkingMinutes: number;
  rows: number;
};

export type ReportAnalytics = {
  from: string;
  to: string;
  trends: ReportTrend[];
  departments: ReportDepartmentStatistic[];
};
