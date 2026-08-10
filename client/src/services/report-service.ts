import { api } from "@/lib/api";
import type {
  DailyReport,
  LateArrivalsReport,
  MonthlyReport,
  OvertimeReport,
  ReportAnalytics,
} from "@/types/attendance";

const today = "2026-08-08";
const fallbackDaily: DailyReport = {
  date: today,
  summary: {
    totalEmployees: 5,
    presentCount: 4,
    absentCount: 1,
    lateCount: 1,
    missingCheckoutCount: 1,
    totalWorkingMinutes: 1513,
  },
  rows: [
    {
      employeeId: "emp-1",
      employeeCode: "EMP-001",
      employee: "Ayesha Khan",
      department: "Operations",
      organization: "Bembex",
      date: today,
      firstCheckIn: "2026-08-08T03:30:00.000Z",
      lastCheckOut: "2026-08-08T12:40:00.000Z",
      workingMinutes: 550,
      status: "PRESENT",
    },
    {
      employeeId: "emp-2",
      employeeCode: "EMP-002",
      employee: "Bilal Ahmed",
      department: "Production",
      organization: "Bembex",
      date: today,
      firstCheckIn: "2026-08-08T04:18:00.000Z",
      lastCheckOut: "2026-08-08T12:12:00.000Z",
      workingMinutes: 474,
      status: "LATE",
    },
    {
      employeeId: "emp-3",
      employeeCode: "EMP-003",
      employee: "Hina Malik",
      department: "HR",
      organization: "Bembex",
      date: today,
      firstCheckIn: "2026-08-08T03:51:00.000Z",
      lastCheckOut: null,
      workingMinutes: 0,
      status: "MISSING_CHECKOUT",
    },
    {
      employeeId: "emp-4",
      employeeCode: "EMP-004",
      employee: "Omar Farooq",
      department: "Security",
      organization: "Bembex",
      date: today,
      firstCheckIn: "2026-08-08T02:55:00.000Z",
      lastCheckOut: "2026-08-08T11:04:00.000Z",
      workingMinutes: 489,
      status: "PRESENT",
    },
    {
      employeeId: "emp-5",
      employeeCode: "EMP-005",
      employee: "Sara Noor",
      department: "Finance",
      organization: "Bembex",
      date: today,
      firstCheckIn: null,
      lastCheckOut: null,
      workingMinutes: 0,
      status: "ABSENT",
    },
  ],
};

const fallbackAnalytics: ReportAnalytics = {
  from: "2026-08-02",
  to: today,
  trends: [
    { date: "2026-08-02", present: 82, absent: 7, late: 6, overtimeHours: 11, averageWorkingHours: 8.1, totalWorkingMinutes: 39852, rows: 89 },
    { date: "2026-08-03", present: 85, absent: 5, late: 4, overtimeHours: 14, averageWorkingHours: 8.3, totalWorkingMinutes: 42330, rows: 90 },
    { date: "2026-08-04", present: 80, absent: 9, late: 7, overtimeHours: 9, averageWorkingHours: 7.9, totalWorkingMinutes: 37920, rows: 89 },
    { date: "2026-08-05", present: 88, absent: 4, late: 3, overtimeHours: 18, averageWorkingHours: 8.5, totalWorkingMinutes: 44880, rows: 92 },
    { date: "2026-08-06", present: 84, absent: 6, late: 5, overtimeHours: 12, averageWorkingHours: 8.2, totalWorkingMinutes: 41328, rows: 90 },
    { date: "2026-08-07", present: 52, absent: 3, late: 2, overtimeHours: 6, averageWorkingHours: 7.6, totalWorkingMinutes: 25080, rows: 55 },
  ],
  departments: [
    { department: "Operations", present: 18, absent: 2, late: 1, overtimeHours: 5, averageWorkingHours: 8.3, totalWorkingMinutes: 8964, rows: 18 },
    { department: "Production", present: 42, absent: 6, late: 5, overtimeHours: 21, averageWorkingHours: 8.6, totalWorkingMinutes: 21672, rows: 42 },
    { department: "HR", present: 7, absent: 1, late: 0, overtimeHours: 1, averageWorkingHours: 7.9, totalWorkingMinutes: 3318, rows: 7 },
    { department: "Security", present: 12, absent: 0, late: 1, overtimeHours: 9, averageWorkingHours: 8.8, totalWorkingMinutes: 6336, rows: 12 },
    { department: "Finance", present: 9, absent: 2, late: 1, overtimeHours: 2, averageWorkingHours: 8.0, totalWorkingMinutes: 4320, rows: 9 },
  ],
};

const fallbackMonthly: MonthlyReport = {
  month: "2026-08",
  summary: {
    employees: 5,
    presentDays: 18,
    absentDays: 3,
    lateDays: 4,
    overtimeMinutes: 540,
  },
  rows: fallbackDaily.rows.map((row) => ({
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    employee: row.employee,
    department: row.department,
    organization: row.organization,
    presentDays: row.status === "ABSENT" ? 0 : 4,
    absentDays: row.status === "ABSENT" ? 4 : 0,
    lateDays: row.status === "LATE" ? 2 : 0,
    missingCheckoutDays: row.status === "MISSING_CHECKOUT" ? 1 : 0,
    totalWorkingMinutes: row.workingMinutes * 4,
    overtimeMinutes: Math.max(0, row.workingMinutes - 480),
  })),
};

const fallbackLateArrivals: LateArrivalsReport = {
  from: fallbackAnalytics.from,
  to: today,
  threshold: "09:00",
  summary: {
    count: 2,
    averageMinutesLate: 14,
  },
  rows: [
    {
      employeeId: "emp-2",
      employeeCode: "EMP-002",
      employee: "Bilal Ahmed",
      department: "Production",
      organization: "Bembex",
      date: today,
      arrival: "09:18",
      threshold: "09:00",
      minutesLate: 18,
      status: "LATE",
    },
    {
      employeeId: "emp-5",
      employeeCode: "EMP-005",
      employee: "Sara Noor",
      department: "Finance",
      organization: "Bembex",
      date: "2026-08-06",
      arrival: "09:10",
      threshold: "09:00",
      minutesLate: 10,
      status: "LATE",
    },
  ],
};

const fallbackOvertime: OvertimeReport = {
  from: fallbackAnalytics.from,
  to: today,
  minimumMinutes: 480,
  summary: {
    count: 2,
    overtimeMinutes: 79,
  },
  rows: [
    {
      employeeId: "emp-1",
      employeeCode: "EMP-001",
      employee: "Ayesha Khan",
      department: "Operations",
      organization: "Bembex",
      date: today,
      workingMinutes: 550,
      overtimeMinutes: 70,
      status: "PRESENT",
    },
    {
      employeeId: "emp-4",
      employeeCode: "EMP-004",
      employee: "Omar Farooq",
      department: "Security",
      organization: "Bembex",
      date: today,
      workingMinutes: 489,
      overtimeMinutes: 9,
      status: "PRESENT",
    },
  ],
};

async function getWithFallback<T>(
  path: string,
  fallback: T,
  params?: Record<string, string | number | undefined>,
) {
  try {
    const response = await api.get<T>(path, { params });
    return response.data;
  } catch {
    return fallback;
  }
}

export function getDailyReport(date?: string) {
  return getWithFallback("/reports/daily", fallbackDaily, { date });
}

export function getMonthlyReport(month?: string) {
  return getWithFallback("/reports/monthly", fallbackMonthly, { month });
}

export function getLateArrivalsReport() {
  return getWithFallback("/reports/late-arrivals", fallbackLateArrivals);
}

export function getOvertimeReport() {
  return getWithFallback("/reports/overtime", fallbackOvertime);
}

export function getReportAnalytics() {
  return getWithFallback("/reports/analytics", fallbackAnalytics);
}
