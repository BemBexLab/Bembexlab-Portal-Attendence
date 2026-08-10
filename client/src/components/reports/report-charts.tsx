"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { ReportAnalytics } from "@/types/attendance";

type ReportChartsProps = {
  analytics?: ReportAnalytics;
};

export function ReportCharts({ analytics }: ReportChartsProps) {
  const trends = analytics?.trends ?? [];
  const departments = analytics?.departments ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel>
        <PanelHeader>
          <div>
            <h2 className="text-sm font-semibold">Attendance trends</h2>
            <p className="text-xs text-muted-foreground">
              Daily present, absent, and late movement.
            </p>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} />
                <YAxis tickLine={false} width={32} />
                <Tooltip />
                <Line dataKey="present" stroke="var(--color-chart-2)" strokeWidth={2} />
                <Line dataKey="absent" stroke="var(--color-chart-5)" strokeWidth={2} />
                <Line dataKey="late" stroke="var(--color-chart-4)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <h2 className="text-sm font-semibold">Department statistics</h2>
            <p className="text-xs text-muted-foreground">
              Attendance distribution by department.
            </p>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={departments}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" tickLine={false} />
                <YAxis tickLine={false} width={32} />
                <Tooltip />
                <Bar dataKey="present" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <h2 className="text-sm font-semibold">Working hour analytics</h2>
            <p className="text-xs text-muted-foreground">
              Average hours and overtime by day.
            </p>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} />
                <YAxis tickLine={false} width={32} />
                <Tooltip />
                <Line
                  dataKey="averageWorkingHours"
                  name="Average hours"
                  stroke="var(--color-chart-3)"
                  strokeWidth={2}
                />
                <Line
                  dataKey="overtimeHours"
                  name="Overtime hours"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
