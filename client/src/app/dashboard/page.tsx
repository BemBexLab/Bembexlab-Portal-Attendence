"use client";

import {
  CalendarCheck,
  Clock3,
  MonitorCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { DepartmentChart } from "@/components/charts/department-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { useDailyReport } from "@/hooks/use-reports";

const AttendanceTrendChart = dynamic(
  () =>
    import("@/components/charts/attendance-trend-chart").then(
      (module) => module.AttendanceTrendChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-80 animate-pulse rounded-xl border border-border bg-muted/50 xl:col-span-7 xl:row-span-2" />
    ),
  },
);

export default function DashboardPage() {
  const daily = useDailyReport();
  const data = daily.data
    ? {
        totalEmployees: daily.data.summary.totalEmployees,
        presentCount: daily.data.summary.presentCount,
        absentCount: daily.data.summary.absentCount,
        lateCount: daily.data.summary.lateCount,
      }
    : undefined;

  return (
    <AppShell
      description="Attendance and employee data from the VPS database."
      title="Dashboard"
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="Employees checked in"
            icon={CalendarCheck}
            label="Today's Attendance"
            value={data ? `${data.presentCount}/${data.totalEmployees}` : "-"}
          />
          <MetricCard
            detail="From raw punches"
            icon={UserCheck}
            label="Present Count"
            value={data?.presentCount ?? "-"}
          />
          <MetricCard
            detail="No arrival punch"
            icon={UserX}
            label="Absent Count"
            value={data?.absentCount ?? "-"}
          />
          <MetricCard
            detail="After shift threshold"
            icon={Clock3}
            label="Late Employees"
            value={data?.lateCount ?? "-"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Employees", "Manage profiles, shifts, and status.", "/employees"],
            ["Attendance", "Review daily and monthly records.", "/attendance"],
            ["Payroll", "Manage compensation and deductions.", "/payroll"],
            ["Requests", "Review pending employee requests.", "/requests"],
          ].map(([label, detail, href]) => (
            <Link className="group rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md" href={href} key={href}>
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{label}</p><span className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground">→</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </Link>
          ))}
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-12">
          <AttendanceTrendChart className="xl:col-span-7 xl:row-span-2" />
          <DepartmentChart className="xl:col-span-5" />
        </div>

        {/* <AttendanceTable /> */}
      </div>
    </AppShell>
  );
}
