"use client";

import { CalendarRange, Laptop, Search, Umbrella } from "lucide-react";
import { useState } from "react";

import { AttendanceStatusBadge } from "@/components/attendance/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useAssignBulkAttendanceStatus,
  useEmployees,
  useScheduledAttendanceStatuses,
} from "@/hooks/use-attendance-data";

type ScheduledStatus = "REMOTE" | "ON_LEAVE";

export default function LeaveRemotePage() {
  const employees = useEmployees();
  const scheduled = useScheduledAttendanceStatuses();
  const assignStatus = useAssignBulkAttendanceStatus();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<ScheduledStatus>("REMOTE");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const activeEmployees = (employees.data ?? []).filter(
    (employee) =>
      employee.isActive &&
      (!employeeSearch.trim() ||
        employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        employee.employeeCode
          .toLowerCase()
          .includes(employeeSearch.toLowerCase())),
  );
  const selectedEmployee = (employees.data ?? []).find(
    (employee) => employee.id === employeeId,
  );

  const submit = async () => {
    if (!employeeId || !from || !to || from > to) {
      setMessage("Choose an employee and a valid date range.");
      return;
    }

    setMessage(null);

    try {
      const result = await assignStatus.mutateAsync({
        employeeId,
        from,
        to,
        status,
      });
      setMessage(
        `${result.assignedDates.length} working day${result.assignedDates.length === 1 ? "" : "s"} scheduled${result.skippedWeekendDays ? `; ${result.skippedWeekendDays} weekend day${result.skippedWeekendDays === 1 ? "" : "s"} skipped` : ""}.`,
      );
    } catch {
      setMessage("The schedule could not be saved. Dates must be today or later.");
    }
  };

  return (
    <AppShell
      description="Schedule approved leave and remote work before attendance is processed."
      title="Leave & Remote"
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <PanelHeader>
            <div>
              <h2 className="text-sm font-semibold">Assign status in advance</h2>
              <p className="text-xs text-muted-foreground">
                Saturday and Sunday are skipped automatically.
              </p>
            </div>
            <CalendarRange className="size-4 text-muted-foreground" />
          </PanelHeader>
          <PanelBody className="space-y-4">
            <div className="relative block text-xs font-medium text-muted-foreground">
              <label htmlFor="employee-search">Find employee</label>
              <span className="relative mt-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <input
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                  autoComplete="off"
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                    setEmployeeId("");
                  }}
                  placeholder="Search name or employee code"
                  role="combobox"
                  aria-expanded={Boolean(employeeSearch.trim() && !selectedEmployee)}
                  aria-controls="employee-suggestions"
                  id="employee-search"
                  value={employeeSearch}
                />
              </span>
              {employeeSearch.trim() && !selectedEmployee ? (
                <span
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-1.5 shadow-xl"
                  id="employee-suggestions"
                  role="listbox"
                >
                  {activeEmployees.length ? (
                    activeEmployees.slice(0, 10).map((employee) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-muted"
                        key={employee.id}
                        onClick={() => {
                          setEmployeeId(employee.id);
                          setEmployeeSearch(
                            `${employee.employeeCode} · ${employee.name}`,
                          );
                        }}
                        role="option"
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {employee.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {employee.employeeCode} · {employee.department ?? "Unassigned"}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="block px-3 py-4 text-center text-sm text-muted-foreground">
                      No active employee found.
                    </span>
                  )}
                </span>
              ) : null}
              {selectedEmployee ? (
                <span className="mt-2 block text-xs text-emerald-700">
                  Selected: {selectedEmployee.name} ({selectedEmployee.employeeCode})
                </span>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[
                  { value: "REMOTE" as const, label: "Remote", icon: Laptop },
                  { value: "ON_LEAVE" as const, label: "Leave", icon: Umbrella },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition ${status === option.value ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted"}`}
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      type="button"
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                Start date
                <input
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                  max={to || undefined}
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                  value={from}
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                End date
                <input
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                  type="date"
                  value={to}
                />
              </label>
            </div>

            {message ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {message}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={assignStatus.isPending || !employeeId || !from || !to}
              onClick={submit}
              type="button"
              variant="primary"
            >
              {assignStatus.isPending ? "Saving schedule..." : "Save schedule"}
            </Button>
          </PanelBody>
        </Panel>

        <Panel className="min-w-0 overflow-hidden">
          <PanelHeader>
            <div>
              <h2 className="text-sm font-semibold">Upcoming assignments</h2>
              <p className="text-xs text-muted-foreground">
                Approved remote and leave dates from today onward.
              </p>
            </div>
          </PanelHeader>
          <PanelBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(scheduled.data ?? []).map((item) => (
                    <tr className="hover:bg-muted/30" key={item.id}>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {item.date}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.employee}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.employeeCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.department}
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceStatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!scheduled.data?.length && !scheduled.isLoading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No upcoming leave or remote assignments.
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
    </AppShell>
  );
}
