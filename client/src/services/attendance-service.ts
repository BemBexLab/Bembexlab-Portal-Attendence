import { api } from "@/lib/api";
import type {
  AttendanceRow,
  AttendanceExportReport,
  AttendanceTrend,
  DailyReport,
  DepartmentAttendance,
  Device,
  DeviceInfoResponse,
  DeviceSyncResult,
  Employee,
  ReportAnalytics,
  ScheduledAttendanceStatus,
  Shift,
} from "@/types/attendance";

export async function getEmployees() {
  const response = await api.get<Employee[]>("/users/employees");
  return response.data;
}

export async function getShifts() {
  const response = await api.get<Shift[]>("/shifts");
  return response.data;
}

export async function createShift(input: {
  name: string;
  startMinutes: number;
  endMinutes: number;
}) {
  const response = await api.post<Shift>("/shifts", input);
  return response.data;
}

export async function updateShift(input: {
  id: string;
  name?: string;
  startMinutes?: number;
  endMinutes?: number;
  isActive?: boolean;
}) {
  const { id, ...data } = input;
  const response = await api.patch<Shift>(`/shifts/${id}`, data);
  return response.data;
}

export async function deleteShift(id: string) {
  const response = await api.delete<{ id: string; removedAssignments: number }>(
    `/shifts/${id}`,
  );
  return response.data;
}

export async function assignEmployeeShift(input: {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
}) {
  const response = await api.post(
    `/shifts/employees/${input.employeeId}/assign`,
    {
      shiftId: input.shiftId,
      effectiveFrom: input.effectiveFrom,
    },
  );
  return response.data;
}

export async function updateEmployeeStatus(input: {
  employeeId: string;
  isActive: boolean;
}) {
  const response = await api.patch<Employee>(
    `/users/employees/${input.employeeId}/status`,
    { isActive: input.isActive },
  );
  return response.data;
}

export async function updateEmployeeSalary(input: {
  employeeId: string;
  monthlySalary: number;
}) {
  const response = await api.patch<Pick<Employee, "id" | "monthlySalary">>(
    `/users/employees/${input.employeeId}/salary`,
    { monthlySalary: input.monthlySalary },
  );
  return response.data;
}

export async function getAttendanceRows(date?: string) {
  const dailyReport = await getDailyReport(date);

  return {
    date: dailyReport.date,
    rows: dailyReport.rows.map<AttendanceRow>((row) => ({
      id: `${row.employeeId}-${row.date}`,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      date: row.date,
      employee: row.employee,
      department: row.department,
      arrival: formatTime(row.firstCheckIn),
      exit: formatTime(row.lastCheckOut),
      workingMinutes: row.workingMinutes,
      status: row.status,
    })),
  };
}

export async function getAttendanceRowsForRange(from: string, to: string) {
  const response = await api.get<AttendanceExportReport>(
    "/reports/attendance-export",
    { params: { from, to } },
  );

  return {
    from: response.data.from,
    to: response.data.to,
    rows: response.data.rows.map<AttendanceRow>((row) => ({
      id: `${row.employeeId}-${row.date}`,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      date: row.date,
      employee: row.employee,
      department: row.department,
      arrival: formatTime(row.firstCheckIn),
      exit: formatTime(row.lastCheckOut),
      workingMinutes: row.workingMinutes,
      status: row.status,
    })),
  };
}

export async function getDevices() {
  const response = await api.get<Device[]>("/devices");
  return response.data;
}

export async function getDepartmentAttendance() {
  const analytics = await getAnalytics();
  return analytics.departments.map<DepartmentAttendance>((department) => ({
    department: department.department,
    present: department.present,
    absent: department.absent,
    late: department.late,
  }));
}

export async function getAttendanceTrend() {
  const analytics = await getAnalytics();
  return analytics.trends.map<AttendanceTrend>((trend) => ({
    day: trend.date.slice(5),
    present: trend.present,
    absent: trend.absent,
  }));
}

export async function getDashboardSummary() {
  const [dailyReport, liveDevices] = await Promise.all([
    getDailyReport(),
    getDevices(),
  ]);

  return {
    totalEmployees: dailyReport.summary.totalEmployees,
    presentCount: dailyReport.summary.presentCount,
    absentCount: dailyReport.summary.absentCount,
    lateCount: dailyReport.summary.lateCount,
    activeDevices: liveDevices.filter((device) => device.status === "ACTIVE")
      .length,
    offlineDevices: liveDevices.filter((device) => device.status === "OFFLINE")
      .length,
  };
}

export async function testDevice(deviceId: string) {
  const response = await api.post<{ online: boolean; latencyMs: number }>(
    `/devices/${deviceId}/test`,
  );
  return response.data;
}

export async function fetchDeviceInfo(deviceId: string) {
  const response = await api.get<DeviceInfoResponse>(
    `/devices/${deviceId}/info`,
  );
  return response.data;
}

export async function syncDeviceAttendance(deviceId: string) {
  const response = await api.post<DeviceSyncResult>(
    `/devices/${deviceId}/sync-attendance`,
  );
  return response.data;
}

export async function updateAttendanceStatus(input: {
  employeeId: string;
  date: string;
  status: AttendanceRow["status"];
}) {
  const response = await api.patch(
    `/attendance/${input.employeeId}/${input.date}/status`,
    { status: input.status },
  );
  return response.data;
}

export async function assignBulkAttendanceStatus(input: {
  employeeId: string;
  from: string;
  to: string;
  status: "REMOTE" | "ON_LEAVE";
}) {
  const response = await api.post<{
    assignedDates: string[];
    skippedWeekendDays: number;
  }>("/attendance/bulk-status", input);
  return response.data;
}

export async function getScheduledAttendanceStatuses() {
  const response = await api.get<ScheduledAttendanceStatus[]>(
    "/attendance/scheduled-statuses",
  );
  return response.data;
}

export async function removeScheduledAttendanceStatus(id: string) {
  const response = await api.delete<{ id: string; removed: boolean }>(
    `/attendance/scheduled-statuses/${id}`,
  );
  return response.data;
}

async function getDailyReport(date?: string) {
  const response = await api.get<DailyReport>("/reports/daily", {
    params: { date },
  });
  return response.data;
}

export async function getAnalytics() {
  const response = await api.get<ReportAnalytics>("/reports/analytics");
  return response.data;
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;
}
