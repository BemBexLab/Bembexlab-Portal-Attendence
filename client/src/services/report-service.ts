import { api } from "@/lib/api";
import type {
  AttendanceExportReport,
  DailyReport,
  LateArrivalsReport,
  MonthlyReport,
  OvertimeReport,
  ReportAnalytics,
} from "@/types/attendance";

async function getReport<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await api.get<T>(path, { params });
  return response.data;
}

export function getDailyReport(date?: string) {
  return getReport<DailyReport>("/reports/daily", { date });
}

export function getMonthlyReport(month?: string) {
  return getReport<MonthlyReport>("/reports/monthly", { month });
}

export function getLateArrivalsReport() {
  return getReport<LateArrivalsReport>("/reports/late-arrivals");
}

export function getOvertimeReport() {
  return getReport<OvertimeReport>("/reports/overtime");
}

export function getReportAnalytics() {
  return getReport<ReportAnalytics>("/reports/analytics");
}

export function getAttendanceExport(from: string, to: string) {
  return getReport<AttendanceExportReport>("/reports/attendance-export", {
    from,
    to,
  });
}
