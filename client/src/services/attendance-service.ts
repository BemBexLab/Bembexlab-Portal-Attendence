import type {
  AttendanceRow,
  AttendanceTrend,
  DepartmentAttendance,
  Device,
  DeviceInfoResponse,
  DeviceSyncResult,
  Employee,
} from "@/types/attendance";
import type { DailyReport, ReportAnalytics } from "@/types/attendance";
import { api } from "@/lib/api";

const employees: Employee[] = [
  {
    id: "emp-1",
    employeeCode: "EMP-001",
    name: "Ayesha Khan",
    department: "Operations",
    deviceUserId: "1",
    role: "Shift Supervisor",
    status: "ACTIVE",
  },
  {
    id: "emp-2",
    employeeCode: "EMP-002",
    name: "Bilal Ahmed",
    department: "Production",
    deviceUserId: "2",
    role: "Machine Operator",
    status: "ACTIVE",
  },
  {
    id: "emp-3",
    employeeCode: "EMP-003",
    name: "Hina Malik",
    department: "HR",
    deviceUserId: "3",
    role: "HR Manager",
    status: "ACTIVE",
  },
  {
    id: "emp-4",
    employeeCode: "EMP-004",
    name: "Omar Farooq",
    department: "Security",
    deviceUserId: "4",
    role: "Security Officer",
    status: "ACTIVE",
  },
  {
    id: "emp-5",
    employeeCode: "EMP-005",
    name: "Sara Noor",
    department: "Finance",
    deviceUserId: "5",
    role: "Accounts Executive",
    status: "INACTIVE",
  },
];

const attendanceRows: AttendanceRow[] = [
  {
    id: "att-1",
    employeeId: "emp-1",
    employee: "Ayesha Khan",
    department: "Operations",
    arrival: "08:30",
    exit: "17:40",
    workingMinutes: 550,
    status: "PRESENT",
  },
  {
    id: "att-2",
    employeeId: "emp-2",
    employee: "Bilal Ahmed",
    department: "Production",
    arrival: "09:18",
    exit: "17:12",
    workingMinutes: 474,
    status: "LATE",
  },
  {
    id: "att-3",
    employeeId: "emp-3",
    employee: "Hina Malik",
    department: "HR",
    arrival: "08:51",
    exit: null,
    workingMinutes: 0,
    status: "MISSING_CHECKOUT",
  },
  {
    id: "att-4",
    employeeId: "emp-4",
    employee: "Omar Farooq",
    department: "Security",
    arrival: "07:55",
    exit: "16:04",
    workingMinutes: 489,
    status: "PRESENT",
  },
  {
    id: "att-5",
    employeeId: "emp-5",
    employee: "Sara Noor",
    department: "Finance",
    arrival: null,
    exit: null,
    workingMinutes: 0,
    status: "ABSENT",
  },
];

const devices: Device[] = [
  {
    id: "dev-1",
    name: "K40 Main Gate",
    ip: "192.168.10.197",
    port: 4370,
    status: "ACTIVE",
    lastSync: "2026-08-08T04:40:00.000Z",
  },
  {
    id: "dev-2",
    name: "Warehouse Entry",
    ip: "192.168.10.201",
    port: 4370,
    status: "OFFLINE",
    lastSync: "2026-08-08T02:15:00.000Z",
  },
  {
    id: "dev-3",
    name: "Admin Block",
    ip: "192.168.10.205",
    port: 4370,
    status: "MAINTENANCE",
    lastSync: null,
  },
];

const departmentAttendance: DepartmentAttendance[] = [
  { department: "Operations", present: 18, absent: 2, late: 1 },
  { department: "Production", present: 42, absent: 6, late: 5 },
  { department: "HR", present: 7, absent: 1, late: 0 },
  { department: "Security", present: 12, absent: 0, late: 1 },
  { department: "Finance", present: 9, absent: 2, late: 1 },
];

const attendanceTrend: AttendanceTrend[] = [
  { day: "Mon", present: 82, absent: 7 },
  { day: "Tue", present: 85, absent: 5 },
  { day: "Wed", present: 80, absent: 9 },
  { day: "Thu", present: 88, absent: 4 },
  { day: "Fri", present: 84, absent: 6 },
  { day: "Sat", present: 52, absent: 3 },
];

function wait<T>(data: T) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(data), 120);
  });
}

export async function getEmployees() {
  try {
    const dailyReport = await getDailyReport();

    return dailyReport.rows.map<Employee>((row) => ({
      id: row.employeeId,
      employeeCode: row.employeeCode,
      name: row.employee,
      department: row.department,
      deviceUserId: "-",
      role: "Employee",
      status: row.status === "ABSENT" ? "INACTIVE" : "ACTIVE",
    }));
  } catch {
    return wait(employees);
  }
}

export async function getAttendanceRows() {
  try {
    const dailyReport = await getDailyReport();

    return dailyReport.rows.map<AttendanceRow>((row) => ({
      id: `${row.employeeId}-${row.date}`,
      employeeId: row.employeeId,
      employee: row.employee,
      department: row.department,
      arrival: formatTime(row.firstCheckIn),
      exit: formatTime(row.lastCheckOut),
      workingMinutes: row.workingMinutes,
      status: row.status,
    }));
  } catch {
    return wait(attendanceRows);
  }
}

export async function getDevices() {
  try {
    const response = await api.get<Device[]>("/devices");
    return response.data;
  } catch {
    return wait(devices);
  }
}

export async function getDepartmentAttendance() {
  try {
    const analytics = await getAnalytics();

    return analytics.departments.map<DepartmentAttendance>((department) => ({
      department: department.department,
      present: department.present,
      absent: department.absent,
      late: department.late,
    }));
  } catch {
    return wait(departmentAttendance);
  }
}

export async function getAttendanceTrend() {
  try {
    const analytics = await getAnalytics();

    return analytics.trends.map<AttendanceTrend>((trend) => ({
      day: trend.date.slice(5),
      present: trend.present,
      absent: trend.absent,
    }));
  } catch {
    return wait(attendanceTrend);
  }
}

export async function getDashboardSummary() {
  try {
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
      offlineDevices: liveDevices.filter(
        (device) => device.status === "OFFLINE",
      ).length,
    };
  } catch {
    const presentCount = attendanceRows.filter(
      (row) =>
        row.status === "PRESENT" ||
        row.status === "LATE" ||
        row.status === "MISSING_CHECKOUT",
    ).length;
    const absentCount = attendanceRows.filter(
      (row) => row.status === "ABSENT",
    ).length;
    const lateCount = attendanceRows.filter(
      (row) => row.status === "LATE",
    ).length;

    return wait({
      totalEmployees: employees.length,
      presentCount,
      absentCount,
      lateCount,
      activeDevices: devices.filter((device) => device.status === "ACTIVE")
        .length,
      offlineDevices: devices.filter((device) => device.status === "OFFLINE")
        .length,
    });
  }
}

export async function testDevice(deviceId: string) {
  const response = await api.post<{ online: boolean; latencyMs: number }>(
    `/devices/${deviceId}/test`,
  );
  return response.data;
}

export async function fetchDeviceInfo(deviceId: string) {
  const response = await api.get<DeviceInfoResponse>(`/devices/${deviceId}/info`);
  return response.data;
}

export async function syncDeviceAttendance(deviceId: string) {
  const response = await api.post<DeviceSyncResult>(
    `/devices/${deviceId}/sync-attendance`,
  );
  return response.data;
}

async function getDailyReport() {
  const response = await api.get<DailyReport>("/reports/daily");
  return response.data;
}

async function getAnalytics() {
  const response = await api.get<ReportAnalytics>("/reports/analytics");
  return response.data;
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}
