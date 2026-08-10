"use client";

import { StatusBadge } from "@/components/reports/status-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { LateArrivalRow, OvertimeRow } from "@/types/attendance";

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${hours}h ${remainder}m`;
}

export function LateArrivalsTable({ rows }: { rows: LateArrivalRow[] }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Late arrivals</h2>
          <p className="text-xs text-muted-foreground">
            Employees arriving after the configured threshold.
          </p>
        </div>
      </PanelHeader>
      <PanelBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Arrival</th>
                <th className="px-4 py-3 font-medium">Late</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr className="hover:bg-muted/40" key={`${row.employeeId}-${row.date}`}>
                  <td className="px-4 py-3 font-medium">{row.employee}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{row.arrival}</td>
                  <td className="px-4 py-3">{row.minutesLate}m</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelBody>
    </Panel>
  );
}

export function OvertimeTable({ rows }: { rows: OvertimeRow[] }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Overtime</h2>
          <p className="text-xs text-muted-foreground">
            Working time beyond the daily threshold.
          </p>
        </div>
      </PanelHeader>
      <PanelBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Working Hours</th>
                <th className="px-4 py-3 font-medium">Overtime</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr className="hover:bg-muted/40" key={`${row.employeeId}-${row.date}`}>
                  <td className="px-4 py-3 font-medium">{row.employee}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{formatHours(row.workingMinutes)}</td>
                  <td className="px-4 py-3">{formatHours(row.overtimeMinutes)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelBody>
    </Panel>
  );
}
