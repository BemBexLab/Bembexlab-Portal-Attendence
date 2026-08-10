"use client";

import { Search } from "lucide-react";

import { AttendanceStatusBadge } from "@/components/attendance/status-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useAttendanceRows } from "@/hooks/use-attendance-data";
import { useDashboardStore } from "@/stores/dashboard-store";

function formatHours(minutes: number) {
  if (minutes <= 0) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export function AttendanceTable() {
  const attendance = useAttendanceRows();
  const search = useDashboardStore((state) => state.attendanceSearch);
  const department = useDashboardStore((state) => state.departmentFilter);
  const setSearch = useDashboardStore((state) => state.setAttendanceSearch);
  const setDepartment = useDashboardStore((state) => state.setDepartmentFilter);
  const rows = attendance.data ?? [];
  const departments = [
    "All departments",
    ...Array.from(new Set(rows.map((row) => row.department))),
  ];
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      row.employee.toLowerCase().includes(search.toLowerCase()) ||
      row.department.toLowerCase().includes(search.toLowerCase());
    const matchesDepartment =
      department === "All departments" || row.department === department;

    return matchesSearch && matchesDepartment;
  });

  return (
    <Panel>
      <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold">Attendance table</h2>
          <p className="text-xs text-muted-foreground">
            First punch is arrival; last punch is exit.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20 sm:w-56"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              value={search}
            />
          </label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            onChange={(event) => setDepartment(event.target.value)}
            value={department}
          >
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </PanelHeader>
      <PanelBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Arrival</th>
                <th className="px-4 py-3 font-medium">Exit</th>
                <th className="px-4 py-3 font-medium">Working Hours</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => (
                <tr className="hover:bg-muted/40" key={row.id}>
                  <td className="px-4 py-3 font-medium">{row.employee}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.department}
                  </td>
                  <td className="px-4 py-3">{row.arrival ?? "-"}</td>
                  <td className="px-4 py-3">{row.exit ?? "-"}</td>
                  <td className="px-4 py-3">{formatHours(row.workingMinutes)}</td>
                  <td className="px-4 py-3">
                    <AttendanceStatusBadge status={row.status} />
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
