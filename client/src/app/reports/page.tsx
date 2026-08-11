"use client";

import { CalendarDays, Clock3, Download, Timer, UserCheck, UserX } from "lucide-react";
import { useEffect, useState } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { ReportCharts } from "@/components/reports/report-charts";
import { LateArrivalsTable, OvertimeTable } from "@/components/reports/report-tables";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDailyReport, useLateArrivalsReport, useMonthlyReport, useOvertimeReport, useReportAnalytics } from "@/hooks/use-reports";
import { downloadCsv } from "@/lib/csv";
import { getAttendanceExport } from "@/services/report-service";

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${hours}h ${remainder}m`;
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString([], {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!analytics.data || startDate || endDate) {
      return;
    }

    setStartDate(analytics.data.from);
    setEndDate(analytics.data.to);
  }, [analytics.data, endDate, startDate]);

  const exportAttendanceReport = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setExportError("Choose a valid start and end date.");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const report = await getAttendanceExport(startDate, endDate);

      if (!report.rows.length) {
        setExportError("No attendance data is available for this period.");
        return;
      }

    downloadCsv(
        `attendance-${report.from}-to-${report.to}.csv`,
        report.rows.map((row) => ({
        date: row.date,
        employeeCode: row.employeeCode,
        employee: row.employee,
        department: row.department,
          organization: row.organization,
        arrival: formatTime(row.firstCheckIn),
        exit: formatTime(row.lastCheckOut),
        workingHours: formatHours(row.workingMinutes),
        status: row.status,
      })),
    );
    } catch {
      setExportError("The attendance report could not be exported.");
    } finally {
      setIsExporting(false);
    }
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs text-muted-foreground">
                Start date
                <input
                  className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                  max={endDate || undefined}
                  onChange={(event) => setStartDate(event.target.value)}
                  type="date"
                  value={startDate}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                End date
                <input
                  className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  type="date"
                  value={endDate}
                />
              </label>
              <Button
                disabled={isExporting || !startDate || !endDate}
                onClick={exportAttendanceReport}
                type="button"
                variant="primary"
              >
                <Download className="size-4" />
                {isExporting ? "Exporting..." : "Export report"}
              </Button>
            </div>
          </PanelHeader>
          <PanelBody>
            {exportError ? (
              <p className="mb-3 text-sm text-red-600">{exportError}</p>
            ) : null}
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
