"use client";

import {
  AlertTriangle,
  CalendarCheck,
  Clock3,
  MonitorCheck,
  UserCheck,
  UserX,
} from "lucide-react";

import { AttendanceTable } from "@/components/attendance/attendance-table";
import { AttendanceTrendChart } from "@/components/charts/attendance-trend-chart";
import { DepartmentChart } from "@/components/charts/department-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { DeviceStatusBadge } from "@/components/attendance/status-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDashboardSummary, useDevices } from "@/hooks/use-attendance-data";

export default function DashboardPage() {
  const summary = useDashboardSummary();
  const devices = useDevices();
  const data = summary.data;

  return (
    <AppShell
      description="Realtime operational view for biometric attendance."
      title="Dashboard"
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <MetricCard
            detail={`${data?.offlineDevices ?? 0} offline`}
            icon={MonitorCheck}
            label="Device Status"
            value={`${data?.activeDevices ?? 0} active`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4 lg:grid-cols-2">
            <AttendanceTrendChart />
            <DepartmentChart />
          </div>
          <Panel>
            <PanelHeader>
              <div>
                <h2 className="text-sm font-semibold">Device health</h2>
                <p className="text-xs text-muted-foreground">
                  Sync state from connected K40 devices.
                </p>
              </div>
              <AlertTriangle className="size-4 text-muted-foreground" />
            </PanelHeader>
            <PanelBody className="space-y-3">
              {(devices.data ?? []).map((device) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  key={device.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{device.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {device.ip}:{device.port}
                    </p>
                  </div>
                  <DeviceStatusBadge status={device.status} />
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>

        <AttendanceTable />
      </div>
    </AppShell>
  );
}
