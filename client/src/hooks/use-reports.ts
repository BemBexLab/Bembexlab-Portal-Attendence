"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getDailyReport,
  getLateArrivalsReport,
  getMonthlyReport,
  getOvertimeReport,
  getReportAnalytics,
  getPayrollReport,
  getRawPunches,
} from "@/services/report-service";

export const reportKeys = {
  all: ["reports"] as const,
  daily: (date?: string) => ["reports", "daily", date ?? "today"] as const,
  monthly: (month?: string) => ["reports", "monthly", month ?? "current"] as const,
  lateArrivals: ["reports", "late-arrivals"] as const,
  overtime: ["reports", "overtime"] as const,
  analytics: ["reports", "analytics"] as const,
  payroll: (month?: string) => ["reports", "payroll", month ?? "current"] as const,
  rawPunches: (search: string, page: number, from?: string, to?: string) =>
    ["reports", "raw-punches", search, page, from, to] as const,
};

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: () => getDailyReport(date),
  });
}

export function useMonthlyReport(month?: string) {
  return useQuery({
    queryKey: reportKeys.monthly(month),
    queryFn: () => getMonthlyReport(month),
  });
}

export function useLateArrivalsReport() {
  return useQuery({
    queryKey: reportKeys.lateArrivals,
    queryFn: getLateArrivalsReport,
  });
}

export function useOvertimeReport() {
  return useQuery({
    queryKey: reportKeys.overtime,
    queryFn: getOvertimeReport,
  });
}

export function useReportAnalytics() {
  return useQuery({
    queryKey: reportKeys.analytics,
    queryFn: getReportAnalytics,
  });
}

export function usePayrollReport(month?: string) {
  return useQuery({
    queryKey: reportKeys.payroll(month),
    queryFn: () => getPayrollReport(month),
  });
}

export function useRawPunches(search: string, page: number, from?: string, to?: string) {
  return useQuery({
    queryKey: reportKeys.rawPunches(search, page, from, to),
    queryFn: () => getRawPunches(search, page, from, to),
    enabled: !from || !to || from <= to,
  });
}
