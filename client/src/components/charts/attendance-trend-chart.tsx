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

export function AttendanceTrendChart() {
  const trend = useAttendanceTrend();

  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Weekly trend</h2>
          <p className="text-xs text-muted-foreground">
            Present and absent movement.
          </p>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="h-64">
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
      </PanelBody>
    </Panel>
  );
}
