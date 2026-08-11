"use client";

import { Building2, UsersRound } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDepartmentAttendance } from "@/hooks/use-attendance-data";
import { cn } from "@/lib/utils";

function AttendanceMetric({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", color)} />
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="ml-auto tabular-nums text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

export function DepartmentChart({ className }: { className?: string }) {
  const departments = useDepartmentAttendance();
  const rows = departments.data ?? [];

  return (
    <Panel className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}>
      <PanelHeader>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Department attendance</h2>
          <p className="text-xs text-muted-foreground">
            Seven-day attendance distribution by team.
          </p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Building2 className="size-4" />
        </div>
      </PanelHeader>

      <PanelBody className="min-w-0 flex-1 space-y-3">
        {rows.map((department) => {
          const attendanceTotal = department.present + department.absent;
          const presentPercent = attendanceTotal
            ? (department.present / attendanceTotal) * 100
            : 0;
          const absentPercent = attendanceTotal ? 100 - presentPercent : 0;

          return (
            <article
              className="min-w-0 rounded-xl border border-border bg-muted/20 p-3.5 transition-colors hover:bg-muted/35"
              key={department.department}
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    className="truncate text-sm font-semibold"
                    title={department.department}
                  >
                    {department.department}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {attendanceTotal} employee-days tracked
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
                  <UsersRound className="size-3.5 text-muted-foreground" />
                  {department.present}
                </div>
              </div>

              <div
                aria-label={`${presentPercent.toFixed(0)} percent present and ${absentPercent.toFixed(0)} percent absent`}
                className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
              >
                <span
                  className="h-full bg-[var(--color-chart-2)] transition-[width]"
                  style={{ width: `${presentPercent}%` }}
                />
                <span
                  className="h-full bg-[var(--color-chart-5)] transition-[width]"
                  style={{ width: `${absentPercent}%` }}
                />
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-3 gap-3">
                <AttendanceMetric
                  color="bg-[var(--color-chart-2)]"
                  label="Present"
                  value={department.present}
                />
                <AttendanceMetric
                  color="bg-[var(--color-chart-5)]"
                  label="Absent"
                  value={department.absent}
                />
                <AttendanceMetric
                  color="bg-[var(--color-chart-4)]"
                  label="Late"
                  value={department.late}
                />
              </div>
            </article>
          );
        })}

        {!rows.length && !departments.isLoading ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Building2 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No department data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Attendance will appear after employees are assigned.
            </p>
          </div>
        ) : null}

        {departments.isLoading ? (
          <div className="space-y-3" aria-label="Loading department attendance">
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
            <div className="h-28 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
