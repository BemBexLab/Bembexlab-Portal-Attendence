"use client";

import { CalendarDays, Clock3, UserCheck, UserX } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { PayrollReportPanel } from "@/components/reports/payroll-report";
import { useDailyReport } from "@/hooks/use-reports";

export default function ReportsPage() {
  const dailyReport = useDailyReport();
  const daily = dailyReport.data;

  return (
    <AppShell
      description="Attendance summaries for operations and HR review."
      title="Reports"
    >
      <div className="space-y-4">
        {/* <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="Daily report scope"
            icon={CalendarDays}
            label="Employees"
            value={daily?.summary.totalEmployees ?? "-"}
          />
          <MetricCard
            detail="Present today"
            icon={UserCheck}
            label="Present"
            value={daily?.summary.presentCount ?? "-"}
          />
          <MetricCard
            detail="Absent today"
            icon={UserX}
            label="Absent"
            value={daily?.summary.absentCount ?? "-"}
          />
          <MetricCard
            detail="Late arrivals"
            icon={Clock3}
            label="Late"
            value={daily?.summary.lateCount ?? "-"}
          />
        </div> */}

        <PayrollReportPanel />
      </div>
    </AppShell>
  );
}
