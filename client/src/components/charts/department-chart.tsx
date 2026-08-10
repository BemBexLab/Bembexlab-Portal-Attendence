"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDepartmentAttendance } from "@/hooks/use-attendance-data";

export function DepartmentChart() {
  const departments = useDepartmentAttendance();

  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Department attendance</h2>
          <p className="text-xs text-muted-foreground">
            Present, absent, and late by department.
          </p>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="h-64">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={departments.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="department" tickLine={false} />
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
  );
}
