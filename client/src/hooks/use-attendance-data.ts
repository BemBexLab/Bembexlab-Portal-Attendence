"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchDeviceInfo,
  getAttendanceRows,
  getAttendanceTrend,
  getDashboardSummary,
  getDepartmentAttendance,
  getDevices,
  getEmployees,
  syncDeviceAttendance,
  testDevice,
  updateAttendanceStatus,
  assignBulkAttendanceStatus,
  getScheduledAttendanceStatuses,
  updateEmployeeStatus,
  updateEmployeeSalary,
} from "@/services/attendance-service";

export const attendanceKeys = {
  summary: ["dashboard", "summary"] as const,
  attendance: ["attendance"] as const,
  employees: ["employees"] as const,
  devices: ["devices"] as const,
  departments: ["reports", "departments"] as const,
  trend: ["reports", "trend"] as const,
  scheduledStatuses: ["attendance", "scheduled-statuses"] as const,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: attendanceKeys.summary,
    queryFn: getDashboardSummary,
  });
}

export function useAttendanceRows(date?: string) {
  return useQuery({
    queryKey: [...attendanceKeys.attendance, date ?? "current"],
    queryFn: () => getAttendanceRows(date),
  });
}

export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAttendanceStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.attendance }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.summary }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}

export function useScheduledAttendanceStatuses() {
  return useQuery({
    queryKey: attendanceKeys.scheduledStatuses,
    queryFn: getScheduledAttendanceStatuses,
  });
}

export function useAssignBulkAttendanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignBulkAttendanceStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.scheduledStatuses }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.attendance }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: attendanceKeys.employees,
    queryFn: getEmployees,
  });
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployeeStatus,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.employees }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.attendance }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.summary }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}

export function useUpdateEmployeeSalary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployeeSalary,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.employees }),
        queryClient.invalidateQueries({ queryKey: ["reports", "payroll"] }),
      ]);
    },
  });
}

export function useDevices() {
  return useQuery({
    queryKey: attendanceKeys.devices,
    queryFn: getDevices,
  });
}

export function useTestDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testDevice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.devices });
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.summary });
    },
  });
}

export function useFetchDeviceInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchDeviceInfo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.devices });
    },
  });
}

export function useSyncDeviceAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDeviceAttendance,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKeys.devices }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.summary }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.attendance }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}

export function useDepartmentAttendance() {
  return useQuery({
    queryKey: attendanceKeys.departments,
    queryFn: getDepartmentAttendance,
  });
}

export function useAttendanceTrend() {
  return useQuery({
    queryKey: attendanceKeys.trend,
    queryFn: getAttendanceTrend,
  });
}
