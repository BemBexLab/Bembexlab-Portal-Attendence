"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useAttendanceTrend } from "@/hooks/use-attendance-data";
import { cn } from "@/lib/utils";

export function AttendanceTrendChart({ className }: { className?: string }) {
  const trend = useAttendanceTrend();

  return (
    <Panel className={cn("flex h-full min-w-0 flex-col overflow-hidden", className)}>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Weekly trend</h2>
          <p className="text-xs text-muted-foreground">
            Daily attendance across all active employees for the last 7 days.
          </p>
        </div>
      </PanelHeader>
      <PanelBody className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-64 min-w-0 flex-1">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={trend.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} />
              <YAxis tickLine={false} width={32} />
              <Tooltip />
              <Bar dataKey="present" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--color-chart-2)]" />
            Present (includes half day, remote, and missing checkout)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--color-chart-5)]" />
            Absent (no qualifying attendance for that date)
          </span>
        </div>
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Each date compares how many active employees attended against how
          many had no attendance. The two values together equal the active
          employee total for that day.
        </p>
      </PanelBody>
    </Panel>
  );
}
