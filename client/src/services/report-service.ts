import { api } from "@/lib/api";
import type {
  AttendanceExportReport,
  DailyReport,
  EmployeeHistoryReport,
  LateArrivalsReport,
  MonthlyReport,
  OvertimeReport,
  PayrollReport,
  ReportAnalytics,
  RawPunch,
} from "@/types/attendance";
import type { PaginatedResponse } from "@/types/api";

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

export function getPayrollReport(month?: string) {
  return getReport<PayrollReport>("/reports/payroll", { month });
}

export function getEmployeeHistory(
  employeeId: string,
  from: string,
  to: string,
) {
  return getReport<EmployeeHistoryReport>(
    `/reports/employees/${employeeId}/history`,
    { from, to },
  );
}

export function getRawPunches(
  search: string,
  page: number,
  from?: string,
  to?: string,
  pageSize = 100,
) {
  return getReport<PaginatedResponse<RawPunch>>("/reports/raw-punches", {
    search: search || undefined,
    from,
    to,
    page,
    pageSize,
  });
}

export function getRawPunchesExport(
  search: string,
  from: string,
  to: string,
) {
  return getReport<{ data: RawPunch[]; total: number }>(
    "/reports/raw-punches/export",
    {
      search: search || undefined,
      from,
      to,
    },
  );
}
