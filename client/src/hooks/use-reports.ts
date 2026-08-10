"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getDailyReport,
  getLateArrivalsReport,
  getMonthlyReport,
  getOvertimeReport,
  getReportAnalytics,
} from "@/services/report-service";

export const reportKeys = {
  all: ["reports"] as const,
  daily: (date?: string) => ["reports", "daily", date ?? "today"] as const,
  monthly: (month?: string) => ["reports", "monthly", month ?? "current"] as const,
  lateArrivals: ["reports", "late-arrivals"] as const,
  overtime: ["reports", "overtime"] as const,
  analytics: ["reports", "analytics"] as const,
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
