"use client";

import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";
import { useState } from "react";

import { AttendanceStatusBadge } from "@/components/attendance/status-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import {
  useAttendanceRows,
  useUpdateAttendanceStatus,
} from "@/hooks/use-attendance-data";
import type { AttendanceStatus } from "@/types/attendance";
import { useDashboardStore } from "@/stores/dashboard-store";
import { downloadCsv } from "@/lib/csv";

function formatHours(minutes: number) {
  if (minutes <= 0) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

const editableStatuses: AttendanceStatus[] = [
  "MISSING_CHECKOUT",
  "ABSENT",
  "PRESENT",
  "HALF_DAY",
  "REMOTE",
];

function formatStatus(status: AttendanceStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getPakistanOperationalDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;

  if (Number(value("hour")) >= 21) {
    return date;
  }

  return shiftDate(date, -1);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function AttendanceTable() {
  const currentDate = getPakistanOperationalDate();
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const attendance = useAttendanceRows(selectedDate);
  const updateStatus = useUpdateAttendanceStatus();
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
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
  const exportCsv = () => {
    downloadCsv(
      `attendance-${selectedDate}.csv`,
      filteredRows.map((row) => ({
        date: row.date,
        employee: row.employee,
        department: row.department,
        arrival: row.arrival,
        exit: row.exit,
        workingHours: formatHours(row.workingMinutes),
        status: formatStatus(row.status),
      })),
    );
  };

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
          <Button
            onClick={() => setSelectedDate(shiftDate(currentDate, -1))}
            type="button"
            variant={selectedDate === shiftDate(currentDate, -1) ? "primary" : "secondary"}
          >
            Previous
          </Button>
          <Button
            onClick={() => setSelectedDate(currentDate)}
            type="button"
            variant={selectedDate === currentDate ? "primary" : "secondary"}
          >
            Current
          </Button>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              max={currentDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </label>
          <Button
            disabled={!filteredRows.length}
            onClick={exportCsv}
            type="button"
            variant="secondary"
          >
            <Download className="size-4" />
            CSV
          </Button>
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
                    <div className="relative inline-block">
                        <button
                          aria-expanded={openStatusId === row.id}
                          aria-haspopup="menu"
                          aria-label={`Change ${row.employee}'s attendance status`}
                          className="inline-flex items-center gap-1 rounded-md outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-wait disabled:opacity-60"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            setOpenStatusId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          title="Change attendance status"
                          type="button"
                        >
                          <AttendanceStatusBadge status={row.status} />
                          <ChevronDown className="size-3 text-muted-foreground" />
                        </button>
                        {openStatusId === row.id ? (
                          <div
                            className="absolute right-0 z-30 mt-1 min-w-44 space-y-1 rounded-md border border-border bg-background p-1.5 shadow-lg"
                            role="menu"
                          >
                            {editableStatuses.map((status) => (
                              <button
                                className="flex w-full items-center rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                                disabled={status === row.status}
                                key={status}
                                onClick={() => {
                                  setOpenStatusId(null);
                                  updateStatus.mutate({
                                    employeeId: row.employeeId,
                                    date: row.date,
                                    status,
                                  });
                                }}
                                role="menuitem"
                                type="button"
                              >
                                <AttendanceStatusBadge status={status} />
                                <span className="sr-only">
                                  {formatStatus(status)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                    </div>
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
