"use client";

import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AttendanceStatusBadge } from "@/components/attendance/status-badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  useAttendanceRows,
  useAttendanceRowsForRange,
  useUpdateAttendanceStatus,
} from "@/hooks/use-attendance-data";
import type { AttendanceRow, AttendanceStatus } from "@/types/attendance";
import { useDashboardStore } from "@/stores/dashboard-store";
import {
  downloadDailyAttendanceXlsx,
  downloadMonthlyAttendanceXlsx,
} from "@/lib/attendance-xlsx";
import { cn } from "@/lib/utils";

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
  "ON_LEAVE",
];

function formatStatus(status: AttendanceStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getPayrollCycleMonth(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);

  if (Number(date.slice(8, 10)) < 25) {
    value.setUTCMonth(value.getUTCMonth() - 1);
  }

  return value.toISOString().slice(0, 7);
}

function getPayrollCycle(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { from: "", to: "" };
  }

  const from = `${month}-25`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return { from, to: end.toISOString().slice(0, 10) };
}

function formatCycleDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);

  return {
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
    }).format(value),
    date,
  };
}

export function AttendanceTable() {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCycleMonth, setSelectedCycleMonth] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const currentAttendance = useAttendanceRows();
  const attendance = useAttendanceRows(selectedDate || undefined);
  const currentDate = currentAttendance.data?.date ?? "";
  const currentCycleMonth = currentDate
    ? getPayrollCycleMonth(currentDate)
    : "";
  const cycleMonth = selectedCycleMonth || currentCycleMonth;
  const cycle = getPayrollCycle(cycleMonth);
  const cycleQueryTo =
    cycleMonth === currentCycleMonth && currentDate && currentDate < cycle.to
      ? currentDate
      : cycle.to;
  const monthlyAttendance = useAttendanceRowsForRange(
    cycle.from,
    cycleQueryTo,
  );
  const updateStatus = useUpdateAttendanceStatus();
  const [openStatusMenu, setOpenStatusMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const search = useDashboardStore((state) => state.attendanceSearch);
  const department = useDashboardStore((state) => state.departmentFilter);
  const setSearch = useDashboardStore((state) => state.setAttendanceSearch);
  const setDepartment = useDashboardStore((state) => state.setDepartmentFilter);
  const rows =
    view === "monthly"
      ? (monthlyAttendance.data?.rows ?? []).filter((row) => {
          const weekday = new Date(`${row.date}T00:00:00.000Z`).getUTCDay();
          return weekday !== 0 && weekday !== 6;
        })
      : attendance.data?.rows ?? [];

  useEffect(() => {
    if (!openStatusMenu) {
      return;
    }

    const closeMenu = () => setOpenStatusMenu(null);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [openStatusMenu]);
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
  const monthlyDates = Array.from(new Set(rows.map((row) => row.date))).sort();
  const monthlyEmployees = Array.from(
    filteredRows.reduce((employees, row) => {
      const employee = employees.get(row.employeeId) ?? {
        id: row.employeeId,
        employeeCode: row.employeeCode,
        employee: row.employee,
        department: row.department,
        attendanceByDate: new Map<string, AttendanceRow>(),
      };
      employee.attendanceByDate.set(row.date, row);
      employees.set(row.employeeId, employee);
      return employees;
    }, new Map<string, {
      id: string;
      employeeCode: string;
      employee: string;
      department: string;
      attendanceByDate: Map<string, AttendanceRow>;
    }>()).values(),
  );
  const exportXlsx = async () => {
    const period =
      view === "monthly"
        ? `${cycle.from}-to-${cycleQueryTo}`
        : selectedDate || currentDate;

    setIsExporting(true);
    try {
      if (view === "monthly") {
        await downloadMonthlyAttendanceXlsx(
          `attendance-${period}.xlsx`,
          monthlyDates,
          monthlyEmployees,
          currentDate,
        );
      } else {
        await downloadDailyAttendanceXlsx(
          `attendance-${period}.xlsx`,
          filteredRows,
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  const renderStatusControl = (row: AttendanceRow) => (
    <div className="inline-block">
      <button
        aria-expanded={openStatusMenu?.id === row.id}
        aria-haspopup="menu"
        aria-label={`Change ${row.employee}'s attendance status for ${row.date}`}
        className="inline-flex items-center gap-1 rounded-md outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-wait disabled:opacity-60"
        disabled={updateStatus.isPending}
        onClick={(event) => {
          if (openStatusMenu?.id === row.id) {
            setOpenStatusMenu(null);
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const menuWidth = 176;
          setOpenStatusMenu({
            id: row.id,
            top: rect.bottom + 4,
            left: Math.max(
              8,
              Math.min(
                rect.right - menuWidth,
                window.innerWidth - menuWidth - 8,
              ),
            ),
          });
        }}
        title="Change attendance status"
        type="button"
      >
        <AttendanceStatusBadge status={row.status} />
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>
      {openStatusMenu?.id === row.id
        ? createPortal(
            <div
              className="fixed z-50 min-w-44 space-y-1 rounded-md border border-border bg-background p-1.5 shadow-lg"
              role="menu"
              style={{
                left: openStatusMenu.left,
                top: openStatusMenu.top,
              }}
            >
              {editableStatuses.map((status) => (
                <button
                  className="flex w-full items-center rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                  disabled={status === row.status}
                  key={status}
                  onClick={() => {
                    setOpenStatusMenu(null);
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
                  <span className="sr-only">{formatStatus(status)}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  return (
    <Panel>
      <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold">Attendance table</h2>
          <p className="text-xs text-muted-foreground">
            {view === "monthly" && cycle.from
              ? `Payroll cycle ${cycle.from} through ${cycle.to}${cycleQueryTo !== cycle.to ? `; showing data through ${cycleQueryTo}` : ""}.`
              : "First punch is arrival; last punch is exit."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            disabled={!currentDate}
            onClick={() => {
              setView("daily");
              setSelectedDate("");
            }}
            type="button"
            variant={view === "daily" ? "primary" : "secondary"}
          >
            Daily
          </Button>
          <Button
            disabled={!currentDate}
            onClick={() => {
              setView("monthly");
              setSelectedCycleMonth(currentCycleMonth);
            }}
            type="button"
            variant={view === "monthly" ? "primary" : "secondary"}
          >
            Monthly
          </Button>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              max={
                view === "monthly"
                  ? currentCycleMonth || undefined
                  : currentDate || undefined
              }
              onChange={(event) =>
                view === "monthly"
                  ? setSelectedCycleMonth(event.target.value)
                  : setSelectedDate(event.target.value)
              }
              type={view === "monthly" ? "month" : "date"}
              value={
                view === "monthly" ? cycleMonth : selectedDate || currentDate
              }
            />
          </label>
          <Button
            disabled={!filteredRows.length || isExporting}
            onClick={exportXlsx}
            type="button"
            variant="secondary"
          >
            <Download className="size-4" />
            {isExporting ? "Exporting..." : "XLSX"}
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
          <Select ariaLabel="Filter by department" className="min-w-44" onChange={setDepartment} options={departments.map((item) => ({ value: item, label: item }))} value={department} />
        </div>
      </PanelHeader>
      <PanelBody className="p-0">
        <div className="overflow-x-auto">
          {view === "monthly" ? (
            <table
              className="border-separate border-spacing-0 text-left text-xs"
              style={{ minWidth: 440 + monthlyDates.length * 240 }}
            >
              <thead className="text-muted-foreground">
                <tr>
                  <th
                    className="sticky left-0 z-20 w-28 min-w-28 border-b border-r border-border bg-muted px-3 py-3 font-medium uppercase"
                    rowSpan={2}
                  >
                    Employee ID
                  </th>
                  <th
                    className="sticky left-28 z-20 w-40 min-w-40 border-b border-r border-border bg-muted px-3 py-3 font-medium uppercase"
                    rowSpan={2}
                  >
                    Name
                  </th>
                  <th
                    className="sticky left-[17rem] z-20 w-40 min-w-40 border-b border-r border-border bg-muted px-3 py-3 font-medium uppercase"
                    rowSpan={2}
                  >
                    Department
                  </th>
                  {monthlyDates.map((date) => {
                    const heading = formatCycleDate(date);
                    return (
                      <th
                        className={cn(
                          "min-w-60 border-b border-r border-border px-3 py-2 text-center font-medium",
                          date === currentDate ? "bg-amber-100" : "bg-muted/60",
                        )}
                        colSpan={2}
                        key={date}
                      >
                        <span className="block text-foreground">
                          {heading.weekday}
                        </span>
                        <span className="mt-0.5 block font-normal">
                          {heading.date}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {monthlyDates.map((date) => (
                    <Fragment key={date}>
                      <th
                        className={cn(
                          "w-36 min-w-36 border-b border-r border-border px-3 py-2 text-center font-medium uppercase",
                          date === currentDate ? "bg-amber-100" : "bg-muted/60",
                        )}
                      >
                        Status
                      </th>
                      <th
                        className={cn(
                          "w-24 min-w-24 border-b border-r border-border px-3 py-2 text-center font-medium uppercase",
                          date === currentDate ? "bg-amber-100" : "bg-muted/60",
                        )}
                      >
                        Check-in
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyEmployees.map((employee) => (
                  <tr className="group" key={employee.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-3 font-medium group-hover:bg-muted/40">
                      {employee.employeeCode}
                    </td>
                    <td className="sticky left-28 z-10 border-b border-r border-border bg-card px-3 py-3 font-medium group-hover:bg-muted/40">
                      {employee.employee}
                    </td>
                    <td className="sticky left-[17rem] z-10 border-b border-r border-border bg-card px-3 py-3 text-muted-foreground group-hover:bg-muted/40">
                      {employee.department}
                    </td>
                    {monthlyDates.map((date) => {
                      const row = employee.attendanceByDate.get(date);
                      return (
                        <Fragment key={date}>
                          <td className="border-b border-r border-border px-3 py-2 text-center">
                            {row ? renderStatusControl(row) : "-"}
                          </td>
                          <td className="border-b border-r border-border px-3 py-2 text-center tabular-nums">
                            {row?.arrival ?? "-"}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
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
                    <td className="px-4 py-3">
                      {formatHours(row.workingMinutes)}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusControl(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}
