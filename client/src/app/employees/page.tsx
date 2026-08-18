"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import {
  useAssignEmployeeShift,
  useEmployees,
  useShifts,
  useUpdateEmployeeSalary,
  useUpdateEmployeeStatus,
} from "@/hooks/use-attendance-data";
import { usePayrollReport } from "@/hooks/use-reports";
import { getEmployeeHistory } from "@/services/report-service";

function formatTime(minutes: number) {
  const hour24 = Math.floor(minutes / 60) % 24;
  return `${String(hour24 % 12 || 12).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} ${hour24 >= 12 ? "PM" : "AM"}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHistoryDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  return {
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(value),
    date: new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(value),
  };
}

export default function EmployeesPage() {
  const employees = useEmployees();
  const shifts = useShifts();
  const assignShift = useAssignEmployeeShift();
  const updateStatus = useUpdateEmployeeStatus();
  const updateSalary = useUpdateEmployeeSalary();
  // Payroll is expensive and is only needed by the employee details popup.
  // Avoid competing with the essential employee and shift requests on load.
  const payroll = usePayrollReport(undefined, false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string | null>(
    null,
  );
  const [savingSalaryEmployeeId, setSavingSalaryEmployeeId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const filteredEmployees = (employees.data ?? []).filter((employee) => {
    const query = search.toLowerCase().trim();
    return (
      !query ||
      employee.name.toLowerCase().includes(query) ||
      employee.employeeCode.toLowerCase().includes(query)
    );
  });
  const showEmployeeInfo = async (
    employee: NonNullable<typeof employees.data>[number],
  ) => {
    const payrollData = payroll.data ?? (await payroll.refetch()).data;
    const payrollRow = payrollData?.rows.find(
      (row) => row.employeeId === employee.id,
    );
    const history = payrollData
      ? await getEmployeeHistory(
          employee.id,
          payrollData.cycleStart,
          payrollData.cycleEnd,
        ).catch(() => undefined)
      : undefined;
    const lateEvents = (history?.rows ?? [])
      .filter((row) => row.status === "LATE")
      .map((row) => ({ date: row.date, status: "Late arrival" as const }));
    const absentEvents = (payrollRow?.attendanceDetails ?? [])
      .filter((row) => row.status === "ABSENT")
      .map((row) => ({ date: row.date, status: "Absent" as const }));
    const attendanceEvents = [...lateEvents, ...absentEvents].sort(
      (left, right) => right.date.localeCompare(left.date),
    );
    const eventRows = attendanceEvents.length
      ? attendanceEvents
          .map((event) => {
            const formatted = formatHistoryDate(event.date);
            const isLate = event.status === "Late arrival";
            return `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 12px;border-top:1px solid #e5e7eb"><div><div style="color:#111827;font-size:13px;font-weight:600">${formatted.day}</div><div style="margin-top:2px;color:#6b7280;font-size:12px">${formatted.date}</div></div><span style="border:1px solid ${isLate ? "#fde68a" : "#fecaca"};border-radius:999px;background:${isLate ? "#fffbeb" : "#fef2f2"};padding:4px 9px;color:${isLate ? "#b45309" : "#dc2626"};font-size:11px;font-weight:700">${event.status}</span></div>`;
          })
          .join("")
      : `<div style="padding:24px 16px;text-align:center;color:#6b7280;font-size:13px">No late arrivals or absences in this payroll cycle.</div>`;
    const shift = employee.shift;
    await Swal.fire({
      title: employee.name,
      html: `
        <div style="margin-top:4px;text-align:left">
          <div style="margin-bottom:16px;color:#6b7280;font-size:13px">${employee.employeeCode} · ${employee.department ?? "Unassigned"}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="grid-column:1/-1;border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#f9fafb"><div style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Assigned shift</div><div style="margin-top:6px;color:#111827;font-size:15px;font-weight:600">${shift ? `${shift.name} · ${formatTime(shift.startMinutes)} → ${formatTime(shift.endMinutes)}` : "No shift assigned"}</div></div>
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px"><div style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase">Total late arrivals</div><div style="margin-top:5px;color:#d97706;font-size:24px;font-weight:700">${lateEvents.length}</div></div>
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px"><div style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase">Total absents</div><div style="margin-top:5px;color:#dc2626;font-size:24px;font-weight:700">${absentEvents.length}</div></div>
            <div style="grid-column:1/-1;border:1px solid #bbf7d0;border-radius:10px;padding:14px;background:#f0fdf4"><div style="color:#15803d;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Salary to receive</div><div style="margin-top:5px;color:#166534;font-size:24px;font-weight:700">${payrollRow ? formatMoney(payrollRow.payableSalary) : "Not calculated"}</div>${payrollRow ? `<div style="margin-top:4px;color:#4b5563;font-size:12px">Monthly salary ${formatMoney(payrollRow.monthlySalary)} · Deductions ${formatMoney(payrollRow.deductionAmount)}</div>` : ""}</div>
            <div style="grid-column:1/-1;overflow:hidden;border:1px solid #e5e7eb;border-radius:10px"><div style="padding:12px;background:#f9fafb;color:#374151;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Late and absent history</div><div style="max-height:240px;overflow-y:auto">${eventRows}</div></div>
          </div>
        </div>`,
      width: 620,
      confirmButtonText: "Close",
      confirmButtonColor: "#171717",
      footer: payrollData
        ? `Payroll cycle ${payrollData.cycleStart} to ${payrollData.cycleEnd}`
        : "Payroll data is currently unavailable",
    });
  };
  const toggleStatusMenu = (employeeId: string, element: HTMLButtonElement) => {
    if (openStatusId === employeeId) {
      setOpenStatusId(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setStatusMenuPosition({
      top: rect.bottom + 6,
      left: rect.right - Math.max(132, rect.width),
      width: Math.max(132, rect.width),
    });
    setOpenStatusId(employeeId);
  };
  const assignEmployeeShift = async (
    employee: NonNullable<typeof employees.data>[number],
    shiftId: string,
  ) => {
    const shift = shifts.data?.find((item) => item.id === shiftId);
    if (!shift || employee.shift?.id === shiftId) return;
    const confirmation = await Swal.fire({
      title: `Assign ${shift.name}?`,
      text: `Assign ${employee.name} to this shift effective today?`,
      width: 440,
      padding: "1.5rem",
      showCancelButton: true,
      confirmButtonText: "Assign shift",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
      didOpen: (popup) => {
        const title = popup.querySelector<HTMLElement>(".swal2-title");
        const content = popup.querySelector<HTMLElement>(
          ".swal2-html-container",
        );
        const actions = popup.querySelector<HTMLElement>(".swal2-actions");
        if (title) {
          title.style.padding = "0";
          title.style.fontSize = "1.5rem";
        }
        if (content) {
          content.style.margin = "0.75rem 0 0";
          content.style.fontSize = "0.95rem";
        }
        if (actions) {
          actions.style.margin = "1.25rem 0 0";
        }
      },
    });
    if (!confirmation.isConfirmed) return;
    if (assigningEmployeeId === employee.id) return;
    setAssigningEmployeeId(employee.id);
    try {
      await assignShift.mutateAsync({
        employeeId: employee.id,
        shiftId,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      await Swal.fire({
        title: "Shift assigned",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: "Could not assign shift",
        text: "Please try again.",
        icon: "error",
      });
    } finally {
      setAssigningEmployeeId(null);
    }
  };
  const saveEmployeeSalary = async (
    employee: NonNullable<typeof employees.data>[number],
  ) => {
    const draft = salaryDrafts[employee.id];
    const value = Number(draft);

    if (draft === undefined || !Number.isFinite(value) || value < 0) return;

    const previousSalary = Number(employee.monthlySalary);
    const confirmation = await Swal.fire({
      title:
        previousSalary > 0 ? "Update monthly salary?" : "Add monthly salary?",
      text: `Change ${employee.name}'s monthly salary from ${formatMoney(previousSalary)} to ${formatMoney(value)}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: previousSalary > 0 ? "Update salary" : "Add salary",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;
    if (savingSalaryEmployeeId !== null) return;
    setSavingSalaryEmployeeId(employee.id);

    try {
      await updateSalary.mutateAsync({
        employeeId: employee.id,
        monthlySalary: value,
      });
      setSalaryDrafts((current) => {
        const next = { ...current };
        delete next[employee.id];
        return next;
      });
      await Swal.fire({
        title: "Salary saved",
        text: `${employee.name}'s monthly salary is now ${formatMoney(value)}.`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: "Could not save salary",
        text: "The monthly salary was not changed. Please try again.",
        icon: "error",
      });
    } finally {
      setSavingSalaryEmployeeId(null);
    }
  };

  return (
    <AppShell
      description="Employee roster mapped to biometric device users."
      title="Employees"
    >
      <Panel>
        <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Employee directory</h2>
            <p className="text-xs text-muted-foreground">
              Device user IDs are used for raw punch matching.
            </p>
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search employees by name or code"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20 sm:w-72"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or employee code"
              value={search}
            />
          </label>
        </PanelHeader>
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Shift</th>
                  <th className="px-4 py-3 font-medium">Device User ID</th>
                  <th className="px-4 py-3 font-medium">Monthly Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((employee) => (
                  <tr
                    className="cursor-pointer hover:bg-muted/40"
                    key={employee.id}
                    onClick={() => void showEmployeeInfo(employee)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {employee.employeeCode}
                    </td>
                    <td className="px-4 py-3">{employee.name}</td>
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Select
                        ariaLabel={`Select shift for ${employee.name}`}
                        className="w-56"
                        disabled={assigningEmployeeId === employee.id}
                        onChange={(shiftId) =>
                          void assignEmployeeShift(employee, shiftId)
                        }
                        options={(shifts.data ?? [])
                          .filter((shift) => shift.isActive)
                          .map((shift) => ({
                            value: shift.id,
                            label: `${shift.name} · ${formatTime(shift.startMinutes)}–${formatTime(shift.endMinutes)}`,
                          }))}
                        placeholder="Choose shift"
                        value={employee.shift?.id ?? ""}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {employee.deviceUserId ?? "Not assigned"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            PKR
                          </span>
                          <input
                            aria-label={`${employee.name} monthly salary`}
                            className="h-8 w-36 rounded-md border border-input bg-background pl-10 pr-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/20"
                            min="0"
                            onChange={(event) =>
                              setSalaryDrafts((current) => ({
                                ...current,
                                [employee.id]: event.target.value,
                              }))
                            }
                            step="0.01"
                            type="number"
                            value={
                              salaryDrafts[employee.id] ??
                              employee.monthlySalary
                            }
                          />
                        </div>
                        <button
                          aria-label={`Save ${employee.name} salary`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            savingSalaryEmployeeId !== null ||
                            salaryDrafts[employee.id] === undefined ||
                            salaryDrafts[employee.id] ===
                              employee.monthlySalary ||
                            Number(salaryDrafts[employee.id]) < 0
                          }
                          onClick={() => void saveEmployeeSalary(employee)}
                          onMouseDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="relative inline-block">
                        <button
                          aria-expanded={openStatusId === employee.id}
                          aria-haspopup="menu"
                          aria-label={`Change ${employee.name}'s employee status`}
                          className="inline-flex items-center gap-1 rounded-md outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-wait disabled:opacity-60"
                          disabled={updateStatus.isPending}
                          onClick={(event) =>
                            toggleStatusMenu(employee.id, event.currentTarget)
                          }
                          onMouseDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          <Badge tone={employee.isActive ? "green" : "neutral"}>
                            {employee.isActive ? "Active" : "In-Active"}
                          </Badge>
                          <ChevronDown className="size-3 text-muted-foreground" />
                        </button>
                        {openStatusId === employee.id &&
                        typeof document !== "undefined"
                          ? createPortal(
                              <div
                                className="fixed z-[100] space-y-1 rounded-md border border-border bg-background p-1.5 shadow-xl"
                                role="menu"
                                style={{
                                  top: statusMenuPosition.top,
                                  left: statusMenuPosition.left,
                                  width: statusMenuPosition.width,
                                }}
                              >
                                {[
                                  { label: "Active", value: true },
                                  { label: "In-Active", value: false },
                                ].map((status) => (
                                  <button
                                    className="flex w-full items-center rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                                    disabled={
                                      status.value === employee.isActive
                                    }
                                    key={status.label}
                                    onClick={() => {
                                      setOpenStatusId(null);
                                      updateStatus.mutate({
                                        employeeId: employee.id,
                                        isActive: status.value,
                                      });
                                    }}
                                    onMouseDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    role="menuitem"
                                    type="button"
                                  >
                                    <Badge
                                      tone={status.value ? "green" : "neutral"}
                                    >
                                      {status.label}
                                    </Badge>
                                  </button>
                                ))}
                              </div>,
                              document.body,
                            )
                          : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredEmployees.length && !employees.isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      No employees match “{search}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
