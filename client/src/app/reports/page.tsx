"use client";

import { CalendarDays, Clock3, Download, Timer, UserCheck, UserX } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { ReportCharts } from "@/components/reports/report-charts";
import { LateArrivalsTable, OvertimeTable } from "@/components/reports/report-tables";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDailyReport, useLateArrivalsReport, useMonthlyReport, useOvertimeReport, useReportAnalytics } from "@/hooks/use-reports";
import { downloadCsv } from "@/lib/csv";

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${hours}h ${remainder}m`;
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

export default function ReportsPage() {
  const dailyReport = useDailyReport();
  const monthlyReport = useMonthlyReport();
  const lateArrivals = useLateArrivalsReport();
  const overtime = useOvertimeReport();
  const analytics = useReportAnalytics();
  const daily = dailyReport.data;
  const monthly = monthlyReport.data;

  const exportDailyReport = () => {
    if (!daily?.rows.length) {
      return;
    }

    downloadCsv(
      `daily-attendance-${daily.date}.csv`,
      daily.rows.map((row) => ({
        date: row.date,
        employeeCode: row.employeeCode,
        employee: row.employee,
        department: row.department,
        arrival: formatTime(row.firstCheckIn),
        exit: formatTime(row.lastCheckOut),
        workingHours: formatHours(row.workingMinutes),
        status: row.status,
      })),
    );
  };

  return (
    <AppShell
      description="Attendance summaries for operations and HR review."
      title="Reports"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <MetricCard
            detail="Monthly overtime"
            icon={Timer}
            label="Overtime"
            value={monthly ? formatHours(monthly.summary.overtimeMinutes) : "-"}
          />
        </div>

        <Panel>
          <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold">Reporting workspace</h2>
              <p className="text-xs text-muted-foreground">
                Daily, monthly, late arrival, and overtime reporting.
              </p>
            </div>
            <Button
              disabled={!daily?.rows.length}
              onClick={exportDailyReport}
              type="button"
              variant="primary"
            >
              <Download className="size-4" />
              CSV
            </Button>
          </PanelHeader>
          <PanelBody>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Period</p>
                <p className="mt-1 text-sm font-medium">
                  {analytics.data?.from ?? "-"} to {analytics.data?.to ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scope</p>
                <p className="mt-1 text-sm font-medium">Organization tenant</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Format</p>
                <p className="mt-1 text-sm font-medium">CSV export ready</p>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <ReportCharts analytics={analytics.data} />

        <div className="grid gap-4 xl:grid-cols-2">
          <LateArrivalsTable rows={lateArrivals.data?.rows ?? []} />
          <OvertimeTable rows={overtime.data?.rows ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
