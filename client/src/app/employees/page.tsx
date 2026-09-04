"use client";

import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  Check,
  ChevronDown,
  Filter,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type EmployeeFilterColumn =
  | "shift"
  | "salary"
  | "status";

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
  const [allowanceDrafts, setAllowanceDrafts] = useState<Record<string, string>>({});
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string | null>(
    null,
  );
  const [savingSalaryEmployeeId, setSavingSalaryEmployeeId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [maximumSalary, setMaximumSalary] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openFilter, setOpenFilter] = useState<EmployeeFilterColumn | null>(
    null,
  );
  const [nameSortDirection, setNameSortDirection] = useState<
    "asc" | "desc" | null
  >(null);
  const [employeeIdSortDirection, setEmployeeIdSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const [filterMenuPosition, setFilterMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
  });
  const salaryCeiling = useMemo(
    () =>
      Math.max(
        0,
        ...(employees.data ?? []).map((employee) =>
          Number(employee.monthlySalary),
        ),
      ),
    [employees.data],
  );
  const shiftFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All shifts" },
      { value: "UNASSIGNED", label: "Unassigned" },
      ...(shifts.data ?? []).map((shift) => ({
        value: shift.id,
        label: shift.name,
      })),
    ],
    [shifts.data],
  );
  const hasColumnFilters = Boolean(
    shiftFilter !== "ALL" ||
      minimumSalary ||
      maximumSalary ||
      statusFilter !== "ALL",
  );
  const salarySliderMaximum = Math.max(1, salaryCeiling);
  const salarySliderMinimumValue = Math.min(
    salarySliderMaximum,
    Math.max(0, minimumSalary === "" ? 0 : Number(minimumSalary)),
  );
  const salarySliderMaximumValue = Math.max(
    salarySliderMinimumValue,
    Math.min(
      salarySliderMaximum,
      maximumSalary === "" ? salarySliderMaximum : Number(maximumSalary),
    ),
  );
  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase().trim();
    const minimum = minimumSalary === "" ? 0 : Number(minimumSalary);
    const maximum = maximumSalary === "" ? Infinity : Number(maximumSalary);
    return (employees.data ?? [])
      .filter(
        (employee) =>
          (!query ||
            employee.name.toLowerCase().includes(query) ||
            employee.employeeCode.toLowerCase().includes(query)) &&
          (shiftFilter === "ALL" ||
            (shiftFilter === "UNASSIGNED"
              ? !employee.shift
              : employee.shift?.id === shiftFilter)) &&
          Number(employee.monthlySalary) >= minimum &&
          Number(employee.monthlySalary) <= maximum &&
          (statusFilter === "ALL" ||
            employee.isActive === (statusFilter === "ACTIVE")),
      )
      .sort((left, right) => {
        if (nameSortDirection) {
          const nameOrder = left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          });
          return (
            (nameSortDirection === "asc" ? nameOrder : -nameOrder) ||
            left.employeeCode.localeCompare(right.employeeCode, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
        }

        const employeeIdOrder = left.employeeCode.localeCompare(
          right.employeeCode,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        );
        return (
          (employeeIdSortDirection === "asc"
            ? employeeIdOrder
            : -employeeIdOrder) ||
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          })
        );
      });
  }, [
    employees.data,
    maximumSalary,
    minimumSalary,
    search,
    shiftFilter,
    statusFilter,
    nameSortDirection,
    employeeIdSortDirection,
  ]);
  const clearColumnFilters = () => {
    setShiftFilter("ALL");
    setMinimumSalary("");
    setMaximumSalary("");
    setStatusFilter("ALL");
  };
  const clearColumnFilter = (column: EmployeeFilterColumn) => {
    if (column === "shift") setShiftFilter("ALL");
    if (column === "salary") {
      setMinimumSalary("");
      setMaximumSalary("");
    }
    if (column === "status") setStatusFilter("ALL");
  };
  const toggleNameSort = () => {
    setNameSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    setEmployeeIdSortDirection("asc");
    setOpenFilter(null);
  };
  const toggleEmployeeIdSort = () => {
    setEmployeeIdSortDirection((current) =>
      current === "asc" ? "desc" : "asc",
    );
    setNameSortDirection(null);
    setOpenFilter(null);
  };
  const isColumnFilterActive = (column: EmployeeFilterColumn) => {
    if (column === "shift") return shiftFilter !== "ALL";
    if (column === "salary") return Boolean(minimumSalary || maximumSalary);
    return statusFilter !== "ALL";
  };
  const toggleColumnFilter = (
    column: EmployeeFilterColumn,
    element: HTMLButtonElement,
  ) => {
    if (openFilter === column) {
      setOpenFilter(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const width = column === "salary" ? 360 : 280;
    setFilterMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - width - 12),
      ),
      width,
    });
    setOpenFilter(column);
  };

  useEffect(() => {
    if (!openFilter) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        target.closest("[data-employee-column-filter]") ||
        target.closest("[data-custom-select]")
      ) {
        return;
      }
      setOpenFilter(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(null);
    };
    const closeOnViewportChange = () => setOpenFilter(null);

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [openFilter]);
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
  const confirmEmployeeStatusChange = async (
    employee: NonNullable<typeof employees.data>[number],
    isActive: boolean,
  ) => {
    if (employee.isActive === isActive || updateStatus.isPending) return;

    const action = isActive ? "activate" : "deactivate";
    const confirmation = await Swal.fire({
      title: `${isActive ? "Activate" : "Deactivate"} ${employee.name}?`,
      text: isActive
        ? "Attendance and payroll monitoring will resume from the moment this employee is activated."
        : "Attendance and payroll monitoring will stop immediately. Existing history will remain saved.",
      icon: isActive ? "question" : "warning",
      showCancelButton: true,
      confirmButtonText: isActive ? "Activate employee" : "Deactivate employee",
      cancelButtonText: "Cancel",
      confirmButtonColor: isActive ? "#171717" : "#dc2626",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!confirmation.isConfirmed) return;

    try {
      await updateStatus.mutateAsync({
        employeeId: employee.id,
        isActive,
      });
      await Swal.fire({
        title: `Employee ${isActive ? "activated" : "deactivated"}`,
        text: `${employee.name} is now ${isActive ? "active" : "inactive"}.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: `Could not ${action} employee`,
        text: "The employee status was not changed. Please try again.",
        icon: "error",
      });
    }
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
  const saveEmployeeAllowance = async (
    employee: NonNullable<typeof employees.data>[number],
  ) => {
    const draft = allowanceDrafts[employee.id];
    const value = Number(draft);

    if (draft === undefined || !Number.isFinite(value) || value < 0) return;

    const previousAllowance = Number(employee.allowance);
    const confirmation = await Swal.fire({
      title:
        previousAllowance > 0 ? "Update allowance?" : "Add allowance?",
      text: `Change ${employee.name}'s allowance from ${formatMoney(previousAllowance)} to ${formatMoney(value)}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: previousAllowance > 0 ? "Update allowance" : "Add allowance",
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
        allowance: value,
      });
      setAllowanceDrafts((current) => {
        const next = { ...current };
        delete next[employee.id];
        return next;
      });
      await Swal.fire({
        title: "Allowance saved",
        text: `${employee.name}'s allowance is now ${formatMoney(value)}.`,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: "Could not save allowance",
        text: "The allowance was not changed. Please try again.",
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
          <div className="flex items-center gap-2">
            {hasColumnFilters ? (
              <button
                className="h-9 shrink-0 rounded-md border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted"
                onClick={clearColumnFilters}
                type="button"
              >
                Clear filters
              </button>
            ) : null}
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search employees by name or code"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20 sm:w-72"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or employee code"
                value={search}
              />
            </label>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-16 px-4 py-3 font-medium">S.No</th>
                  {/* <th className="px-4 py-3 font-medium">Code</th> */}
                  <th className="px-2 py-2 font-medium">
                    <button
                      aria-label={
                        nameSortDirection === "asc"
                          ? "Sort employees by name descending"
                          : "Sort employees by name ascending"
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
                      onClick={toggleNameSort}
                      title={
                        nameSortDirection === "asc"
                          ? "Sorted A–Z; click for Z–A"
                          : "Sort employees A–Z"
                      }
                      type="button"
                    >
                      <span>Employee</span>
                      {nameSortDirection === "desc" ? (
                        <ArrowDownZA className="size-3.5" />
                      ) : (
                        <ArrowDownAZ className="size-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-2 py-2 font-medium">
                    <button
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted ${isColumnFilterActive("shift") ? "bg-muted text-foreground" : ""}`}
                      data-employee-column-filter
                      onClick={(event) =>
                        toggleColumnFilter("shift", event.currentTarget)
                      }
                      type="button"
                    >
                      <span>Shift</span>
                      <Filter className="size-3.5" />
                    </button>
                  </th>
                  <th className="px-2 py-2 font-medium">
                    <button
                      aria-label={
                        employeeIdSortDirection === "asc"
                          ? "Sort employee IDs descending"
                          : "Sort employee IDs ascending"
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-muted"
                      onClick={toggleEmployeeIdSort}
                      title={
                        employeeIdSortDirection === "asc"
                          ? "Sorted 0–max; click for max–0"
                          : "Sorted max–0; click for 0–max"
                      }
                      type="button"
                    >
                      <span>Employee ID</span>
                      {employeeIdSortDirection === "desc" ? (
                        <ArrowDown10 className="size-3.5 shrink-0" />
                      ) : (
                        <ArrowDown01 className="size-3.5 shrink-0" />
                      )}
                    </button>
                  </th>
                  <th className="px-2 py-2 font-medium">
                    <button
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted ${isColumnFilterActive("salary") ? "bg-muted text-foreground" : ""}`}
                      data-employee-column-filter
                      onClick={(event) =>
                        toggleColumnFilter("salary", event.currentTarget)
                      }
                      type="button"
                    >
                      <span>Monthly Salary</span>
                      <Filter className="size-3.5" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">Allowance</th>
                  <th className="px-2 py-2 font-medium">
                    <button
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted ${isColumnFilterActive("status") ? "bg-muted text-foreground" : ""}`}
                      data-employee-column-filter
                      onClick={(event) =>
                        toggleColumnFilter("status", event.currentTarget)
                      }
                      type="button"
                    >
                      <span>Status</span>
                      <Filter className="size-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((employee, index) => (
                  <tr
                    className="cursor-pointer hover:bg-muted/40"
                    key={employee.id}
                    onClick={() => void showEmployeeInfo(employee)}
                  >
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {index + 1}
                    </td>
                    {/* <td className="px-4 py-3 font-medium">
                      {employee.employeeCode}
                    </td> */}
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
                              salaryDrafts[employee.id] ?? employee.monthlySalary
                            }
                          />
                        </div>
                        <button
                          aria-label={`Save ${employee.name} salary`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            savingSalaryEmployeeId !== null ||
                            salaryDrafts[employee.id] === undefined ||
                            salaryDrafts[employee.id] === employee.monthlySalary ||
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
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            PKR
                          </span>
                          <input
                            aria-label={`${employee.name} allowance`}
                            className="h-8 w-36 rounded-md border border-input bg-background pl-10 pr-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring/20"
                            min="0"
                            onChange={(event) =>
                              setAllowanceDrafts((current) => ({
                                ...current,
                                [employee.id]: event.target.value,
                              }))
                            }
                            step="0.01"
                            type="number"
                            value={
                              allowanceDrafts[employee.id] ?? employee.allowance
                            }
                          />
                        </div>
                        <button
                          aria-label={`Save ${employee.name} allowance`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            savingSalaryEmployeeId !== null ||
                            allowanceDrafts[employee.id] === undefined ||
                            allowanceDrafts[employee.id] === employee.allowance ||
                            Number(allowanceDrafts[employee.id]) < 0
                          }
                          onClick={() => void saveEmployeeAllowance(employee)}
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
                                      void confirmEmployeeStatusChange(
                                        employee,
                                        status.value,
                                      );
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
                      colSpan={7}
                    >
                      No employees match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>
      {openFilter && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90] overflow-visible rounded-xl border border-border bg-background p-4 normal-case text-foreground shadow-2xl"
              data-employee-column-filter
              style={filterMenuPosition}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Filter by {openFilter}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {filteredEmployees.length} employee
                    {filteredEmployees.length === 1 ? "" : "s"} shown
                  </p>
                </div>
                <button
                  className="text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                  disabled={!isColumnFilterActive(openFilter)}
                  onClick={() => clearColumnFilter(openFilter)}
                  type="button"
                >
                  Clear
                </button>
              </div>

              {openFilter === "shift" ? (
                <Select
                  ariaLabel="Filter employees by shift"
                  menuMinWidth={248}
                  onChange={setShiftFilter}
                  options={shiftFilterOptions}
                  value={shiftFilter}
                />
              ) : null}

              {openFilter === "salary" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-center text-sm font-semibold tabular-nums">
                    {formatMoney(salarySliderMinimumValue)} – {formatMoney(salarySliderMaximumValue)}
                  </div>
                  <div className="relative h-6">
                    <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                    <div
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground"
                      style={{
                        left: `${(salarySliderMinimumValue / salarySliderMaximum) * 100}%`,
                        right: `${100 - (salarySliderMaximumValue / salarySliderMaximum) * 100}%`,
                      }}
                    />
                    <input
                      aria-label="Minimum salary slider"
                      className="pointer-events-none absolute inset-0 z-10 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      max={salarySliderMaximum}
                      min="0"
                      onChange={(event) => {
                        const next = Math.min(
                          Number(event.target.value),
                          salarySliderMaximumValue,
                        );
                        setMinimumSalary(next === 0 ? "" : String(next));
                      }}
                      step="1000"
                      type="range"
                      value={salarySliderMinimumValue}
                    />
                    <input
                      aria-label="Maximum salary slider"
                      className="pointer-events-none absolute inset-0 z-20 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                      max={salarySliderMaximum}
                      min="0"
                      onChange={(event) => {
                        const next = Math.max(
                          Number(event.target.value),
                          salarySliderMinimumValue,
                        );
                        setMaximumSalary(
                          next === salarySliderMaximum ? "" : String(next),
                        );
                      }}
                      step="1000"
                      type="range"
                      value={salarySliderMaximumValue}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground">
                      Minimum
                      <span className="relative mt-1 block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">PKR</span>
                        <input
                          aria-label="Minimum monthly salary"
                          className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-2 text-right text-sm tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                          max={salarySliderMaximumValue}
                          min="0"
                          onChange={(event) =>
                            setMinimumSalary(event.target.value)
                          }
                          placeholder="0"
                          type="number"
                          value={minimumSalary}
                        />
                      </span>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Maximum
                      <span className="relative mt-1 block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">PKR</span>
                        <input
                          aria-label="Maximum monthly salary"
                          className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-2 text-right text-sm tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                          max={salarySliderMaximum}
                          min={salarySliderMinimumValue}
                          onChange={(event) =>
                            setMaximumSalary(event.target.value)
                          }
                          placeholder={String(salaryCeiling)}
                          type="number"
                          value={maximumSalary}
                        />
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {openFilter === "status" ? (
                <Select
                  ariaLabel="Filter employees by status"
                  menuMinWidth={248}
                  onChange={setStatusFilter}
                  options={[
                    { value: "ALL", label: "All statuses" },
                    {
                      value: "ACTIVE",
                      label: "Active",
                      indicatorClassName: "bg-emerald-500",
                    },
                    {
                      value: "INACTIVE",
                      label: "Inactive",
                      indicatorClassName: "bg-slate-400",
                    },
                  ]}
                  value={statusFilter}
                />
              ) : null}

              <button
                className="mt-4 h-9 w-full rounded-md bg-foreground text-sm font-medium text-background transition hover:opacity-90"
                onClick={() => setOpenFilter(null)}
                type="button"
              >
                Done
              </button>
            </div>,
            document.body,
          )
        : null}
    </AppShell>
  );
}
