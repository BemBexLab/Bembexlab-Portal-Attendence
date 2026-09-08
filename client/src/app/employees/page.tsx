"use client";

import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  Check,
  ChevronDown,
  Filter,
  MoreHorizontal,
  SlidersHorizontal,
  X,
  Pencil,
  Plus,
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
  useCreateEmployeeEarning,
  useDeleteEmployeeEarning,
  useEmployees,
  useUpdateEmployeeEarningStatus,
  useShifts,
  useUpdateEmployeeSalary,
  useUpdateEmployeeStatus,
} from "@/hooks/use-attendance-data";
import { usePayrollReport } from "@/hooks/use-reports";
import { getEmployeeHistory } from "@/services/report-service";
import { getEmployeeEarnings } from "@/services/attendance-service";
import type { Employee, EmployeeEarning, PayrollRow } from "@/types/attendance";

type EmployeeFilterColumn =
  | "all"
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
  const createEarning = useCreateEmployeeEarning();
  const updateEarningStatus = useUpdateEmployeeEarningStatus();
  const deleteEarning = useDeleteEmployeeEarning();
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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPayrollRow, setSelectedPayrollRow] = useState<PayrollRow | null>(null);
  const [selectedAttendanceEvents, setSelectedAttendanceEvents] = useState<
    Array<{ date: string; status: "Late arrival" | "Absent" }>
  >([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showCompensationEditor, setShowCompensationEditor] = useState(false);
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
    if (column === "all") {
      clearColumnFilters();
      return;
    }
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
    if (column === "all") return hasColumnFilters;
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
    const width = column === "salary" || column === "all" ? 360 : 280;
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
  const manageEmployeeEarnings = async (
    employee: NonNullable<typeof employees.data>[number],
  ) => {
    const currentDate = new Date();
    if (currentDate.getDate() < 26) {
      currentDate.setMonth(currentDate.getMonth() - 1);
    }
    const defaultMonth = payroll.data?.month ?? currentDate.toISOString().slice(0, 7);
    const earnings = await getEmployeeEarnings({
      employeeId: employee.id,
      month: defaultMonth,
    }).catch(() => [] as EmployeeEarning[]);
    const earningRows = earnings.length
      ? earnings
          .map(
            (earning) => `
              <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border-top:1px solid #e5e7eb;padding:10px 0;text-align:left">
                <div><strong style="font-size:13px">${earning.type === "BONUS" ? "Bonus" : "Commission"}</strong><div style="color:#6b7280;font-size:12px">${earning.percentage ? `${earning.percentage}% of monthly salary` : formatMoney(Number(earning.amount))}${earning.description ? ` · ${earning.description}` : ""}</div></div>
                <div style="display:flex;align-items:center;gap:6px"><select data-earning-status="${earning.id}" style="border:1px solid #d1d5db;border-radius:6px;padding:5px;font-size:12px"><option value="PENDING" ${earning.status === "PENDING" ? "selected" : ""}>Pending</option><option value="APPROVED" ${earning.status === "APPROVED" ? "selected" : ""}>Approved</option><option value="PAID" ${earning.status === "PAID" ? "selected" : ""}>Paid</option><option value="CANCELLED" ${earning.status === "CANCELLED" ? "selected" : ""}>Cancelled</option></select><button type="button" data-earning-delete="${earning.id}" style="border:1px solid #fecaca;border-radius:6px;color:#dc2626;padding:5px 8px;font-size:12px">Remove</button></div>
              </div>`,
          )
          .join("")
      : `<p style="padding:12px 0;color:#6b7280;font-size:13px;text-align:center">No bonus or commission entries for ${defaultMonth}.</p>`;

    const result = await Swal.fire({
      title: `Bonus / Commission · ${employee.name}`,
      html: `<div style="text-align:left"><p style="margin:0 0 12px;color:#6b7280;font-size:12px">Payroll cycle</p><input id="earning-month" type="month" value="${defaultMonth}" style="width:100%;height:38px;border:1px solid #d1d5db;border-radius:7px;padding:0 10px;margin-bottom:12px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><select id="earning-type" style="height:38px;border:1px solid #d1d5db;border-radius:7px;padding:0 8px"><option value="BONUS">Bonus</option><option value="COMMISSION">Commission</option></select><input id="earning-amount" type="number" min="0" step="0.01" placeholder="Fixed amount" style="height:38px;border:1px solid #d1d5db;border-radius:7px;padding:0 10px"></div><input id="earning-percentage" type="number" min="0" max="100" step="0.01" placeholder="Commission percentage (optional)" style="width:100%;height:38px;border:1px solid #d1d5db;border-radius:7px;padding:0 10px;margin-top:8px"><input id="earning-description" type="text" maxlength="255" placeholder="Description (optional)" style="width:100%;height:38px;border:1px solid #d1d5db;border-radius:7px;padding:0 10px;margin-top:8px"><div style="margin-top:18px;border-top:1px solid #e5e7eb;padding-top:6px"><p style="margin:0;color:#374151;font-size:12px;font-weight:700">Existing entries</p>${earningRows}</div></div>`,
      width: 640,
      showCancelButton: true,
      confirmButtonText: "Add earning",
      cancelButtonText: "Close",
      confirmButtonColor: "#171717",
      reverseButtons: true,
      focusCancel: true,
      preConfirm: () => {
        const popup = Swal.getPopup();
        const amount = Number(
          popup?.querySelector<HTMLInputElement>("#earning-amount")?.value ?? "",
        );
        const percentageInput = popup?.querySelector<HTMLInputElement>(
          "#earning-percentage",
        )?.value;
        const percentage = percentageInput ? Number(percentageInput) : undefined;
        if (!Number.isFinite(amount) || amount < 0) {
          Swal.showValidationMessage("Enter a valid fixed amount.");
          return false;
        }
        if (
          percentage !== undefined &&
          (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
        ) {
          Swal.showValidationMessage("Commission percentage must be between 0 and 100.");
          return false;
        }
        return {
          type: popup?.querySelector<HTMLSelectElement>("#earning-type")?.value as EmployeeEarning["type"],
          amount,
          percentage,
          payrollCycleMonth: popup?.querySelector<HTMLInputElement>("#earning-month")?.value ?? defaultMonth,
          description: popup?.querySelector<HTMLInputElement>("#earning-description")?.value ?? "",
        };
      },
      didOpen: (popup) => {
        popup.querySelectorAll<HTMLButtonElement>("[data-earning-delete]").forEach((button) => {
          button.addEventListener("click", async () => {
            const earningId = button.dataset.earningDelete;
            if (!earningId) return;
            const confirmation = await Swal.fire({
              title: "Remove earning?",
              text: "This entry will be removed from the selected payroll cycle.",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Remove",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#dc2626",
            });
            if (!confirmation.isConfirmed) return;
            await deleteEarning.mutateAsync({ employeeId: employee.id, earningId });
            Swal.close();
            await manageEmployeeEarnings(employee);
          });
        });
        popup.querySelectorAll<HTMLSelectElement>("[data-earning-status]").forEach((select) => {
          select.addEventListener("change", async () => {
            const earningId = select.dataset.earningStatus;
            if (!earningId) return;
            await updateEarningStatus.mutateAsync({
              employeeId: employee.id,
              earningId,
              status: select.value as EmployeeEarning["status"],
            });
          });
        });
      },
    });

    if (!result.isConfirmed || !result.value) return;
    try {
      await createEarning.mutateAsync({ employeeId: employee.id, ...result.value });
      await Swal.fire({
        title: "Earning added",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: "Could not add earning",
        text: "Please check the values and try again.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };
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
  const openEmployeeDrawer = async (
    employee: NonNullable<typeof employees.data>[number],
  ) => {
    setSelectedEmployee(employee);
    setSelectedPayrollRow(null);
    setSelectedAttendanceEvents([]);
    setShowCompensationEditor(false);
    setDetailsLoading(true);
    try {
      const payrollData = payroll.data ?? (await payroll.refetch()).data;
      const payrollRow = payrollData?.rows.find(
        (row) => row.employeeId === employee.id,
      ) ?? null;
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
      setSelectedPayrollRow(payrollRow);
      setSelectedAttendanceEvents(
        [...lateEvents, ...absentEvents].sort((left, right) =>
          right.date.localeCompare(left.date),
        ),
      );
    } catch {
      setSelectedPayrollRow(null);
      setSelectedAttendanceEvents([]);
    } finally {
      setDetailsLoading(false);
    }
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
      setSelectedEmployee((current) =>
        current?.id === employee.id ? { ...current, isActive } : current,
      );
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total employees", employees.data?.length ?? 0, "bg-slate-50 text-slate-700"],
          ["Active", (employees.data ?? []).filter((employee) => employee.isActive).length, "bg-emerald-50 text-emerald-700"],
          ["Inactive", (employees.data ?? []).filter((employee) => !employee.isActive).length, "bg-amber-50 text-amber-700"],
          ["Without shift", (employees.data ?? []).filter((employee) => !employee.shift).length, "bg-sky-50 text-sky-700"],
        ].map(([label, value, tone]) => (
          <div className={`rounded-xl border border-border px-4 py-3 ${tone}`} key={String(label)}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <Panel>
        <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Employee directory</h2>
              <Badge tone="neutral">{filteredEmployees.length} shown</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Search, filter, and select an employee to manage their complete profile.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition hover:bg-muted ${hasColumnFilters ? "border-foreground bg-muted" : "border-border bg-background"}`}
              onClick={(event) => toggleColumnFilter("all", event.currentTarget)}
              type="button"
            >
              <SlidersHorizontal className="size-4" />
              Filters{hasColumnFilters ? " active" : ""}
            </button>
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
          {hasColumnFilters ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-2.5 text-xs">
              <span className="font-medium text-muted-foreground">Active filters:</span>
              {shiftFilter !== "ALL" ? <Badge tone="blue">Shift selected</Badge> : null}
              {minimumSalary || maximumSalary ? <Badge tone="blue">Salary range</Badge> : null}
              {statusFilter !== "ALL" ? <Badge tone={statusFilter === "ACTIVE" ? "green" : "neutral"}>{statusFilter === "ACTIVE" ? "Active" : "Inactive"}</Badge> : null}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-left text-sm">
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
                  <th className="px-4 py-3 font-medium">Bonus / Commission</th>
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
                  <th className="w-16 px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.isLoading
                  ? Array.from({ length: 6 }, (_, index) => (
                      <tr key={`employee-skeleton-${index}`}>
                        <td className="px-4 py-5" colSpan={9}>
                          <div className="h-5 w-full animate-pulse rounded-md bg-muted" />
                        </td>
                      </tr>
                    ))
                  : filteredEmployees.map((employee, index) => (
                  <tr
                    className="cursor-pointer hover:bg-muted/40"
                    key={employee.id}
                    onClick={() => void openEmployeeDrawer(employee)}
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
                      <div className="pointer-events-none mb-1">
                        {employee.shift ? (
                          <>
                            <p className="font-medium">{employee.shift.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(employee.shift.startMinutes)} → {formatTime(employee.shift.endMinutes)}
                            </p>
                          </>
                        ) : (
                          <Badge tone="neutral">Unassigned</Badge>
                        )}
                      </div>
                      <Select
                        ariaLabel={`Select shift for ${employee.name}`}
                        className="hidden"
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
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-medium">{formatMoney(Number(employee.monthlySalary))}</span>
                      <p className="text-xs text-muted-foreground">Base monthly pay</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="font-medium">{formatMoney(Number(employee.allowance))}</span>
                      <p className="text-xs text-muted-foreground">Deducted on absence</p>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        aria-label={`Manage ${employee.name} bonus and commission`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                        onClick={() => void manageEmployeeEarnings(employee)}
                        onMouseDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        <Plus className="size-3.5" />
                        Manage
                      </button>
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
                    <td
                      className="px-3 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        aria-label={`Open actions for ${employee.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"
                        onClick={() => void openEmployeeDrawer(employee)}
                        type="button"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </tr>
                  ))}
                {!filteredEmployees.length && !employees.isLoading ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                      colSpan={9}
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
      {selectedEmployee ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEmployee(null);
          }}
          role="dialog"
        >
          <aside className="ml-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden border-l border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-xl font-semibold">{selectedEmployee.name}</h2>
                  <Badge tone={selectedEmployee.isActive ? "green" : "neutral"}>
                    {selectedEmployee.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Employee ID {selectedEmployee.employeeCode} · Device {selectedEmployee.deviceUserId ?? "Not assigned"}
                </p>
              </div>
              <button
                aria-label="Close employee details"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border transition hover:bg-muted"
                onClick={() => setSelectedEmployee(null)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/30 p-4 sm:col-span-2">
                  <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned shift</p>
                      <p className="mt-1 font-semibold">
                        {selectedEmployee.shift
                          ? `${selectedEmployee.shift.name} · ${formatTime(selectedEmployee.shift.startMinutes)} → ${formatTime(selectedEmployee.shift.endMinutes)}`
                          : "No shift assigned"}
                      </p>
                    </div>
                    <Select
                      ariaLabel={`Change shift for ${selectedEmployee.name}`}
                      className="w-44"
                      disabled={assigningEmployeeId === selectedEmployee.id}
                      onChange={(shiftId) => void assignEmployeeShift(selectedEmployee, shiftId)}
                      options={(shifts.data ?? [])
                        .filter((shift) => shift.isActive)
                        .map((shift) => ({
                          value: shift.id,
                          label: `${shift.name} · ${formatTime(shift.startMinutes)}–${formatTime(shift.endMinutes)}`,
                        }))}
                      placeholder="Choose shift"
                      value={selectedEmployee.shift?.id ?? ""}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payable this cycle</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">
                    {detailsLoading ? "Loading…" : selectedPayrollRow ? formatMoney(selectedPayrollRow.payableSalary) : "Not calculated"}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance exceptions</p>
                  <p className="mt-1 text-xl font-semibold">
                    {detailsLoading ? "Loading…" : selectedAttendanceEvents.length}
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">Compensation</h3>
                    <p className="text-xs text-muted-foreground">Salary and allowance are saved in the VPS database.</p>
                  </div>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                    onClick={() => {
                      setSalaryDrafts((current) => ({ ...current, [selectedEmployee.id]: selectedEmployee.monthlySalary }));
                      setAllowanceDrafts((current) => ({ ...current, [selectedEmployee.id]: selectedEmployee.allowance }));
                      setShowCompensationEditor((current) => !current);
                    }}
                    type="button"
                  >
                    <Pencil className="size-3.5" />
                    {showCompensationEditor ? "Close" : "Edit"}
                  </button>
                </div>
                {showCompensationEditor ? (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Monthly salary
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                        min="0"
                        onChange={(event) => setSalaryDrafts((current) => ({ ...current, [selectedEmployee.id]: event.target.value }))}
                        step="0.01"
                        type="number"
                        value={salaryDrafts[selectedEmployee.id] ?? selectedEmployee.monthlySalary}
                      />
                      <button className="mt-2 h-9 w-full rounded-md bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50" disabled={savingSalaryEmployeeId !== null} onClick={() => void saveEmployeeSalary(selectedEmployee)} type="button">Save salary</button>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Allowance
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                        min="0"
                        onChange={(event) => setAllowanceDrafts((current) => ({ ...current, [selectedEmployee.id]: event.target.value }))}
                        step="0.01"
                        type="number"
                        value={allowanceDrafts[selectedEmployee.id] ?? selectedEmployee.allowance}
                      />
                      <button className="mt-2 h-9 w-full rounded-md border border-border px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-50" disabled={savingSalaryEmployeeId !== null} onClick={() => void saveEmployeeAllowance(selectedEmployee)} type="button">Save allowance</button>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    <div><p className="text-xs text-muted-foreground">Monthly salary</p><p className="mt-1 font-semibold tabular-nums">{formatMoney(Number(selectedEmployee.monthlySalary))}</p></div>
                    <div><p className="text-xs text-muted-foreground">Allowance</p><p className="mt-1 font-semibold tabular-nums">{formatMoney(Number(selectedEmployee.allowance))}</p></div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div><h3 className="text-sm font-semibold">Bonus and commission</h3><p className="text-xs text-muted-foreground">Manage cycle-specific earnings and approval status.</p></div>
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background transition hover:opacity-90" onClick={() => void manageEmployeeEarnings(selectedEmployee)} type="button"><Plus className="size-3.5" />Manage</button>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Bonus this cycle</p><p className="mt-1 font-semibold tabular-nums">{selectedPayrollRow ? formatMoney(selectedPayrollRow.bonusAmount) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Commission this cycle</p><p className="mt-1 font-semibold tabular-nums">{selectedPayrollRow ? formatMoney(selectedPayrollRow.commissionAmount) : "—"}</p></div>
                </div>
              </section>

              <section className="rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div><h3 className="text-sm font-semibold">Late and absent history</h3><p className="text-xs text-muted-foreground">Current payroll cycle exceptions.</p></div>
                  <Badge tone="neutral">{selectedAttendanceEvents.length}</Badge>
                </div>
                {detailsLoading ? <p className="p-5 text-center text-sm text-muted-foreground">Loading attendance history…</p> : selectedAttendanceEvents.length ? <div className="divide-y divide-border">{selectedAttendanceEvents.map((event) => { const formatted = formatHistoryDate(event.date); return <div className="flex items-center justify-between gap-3 px-4 py-3" key={`${event.date}-${event.status}`}><div><p className="text-sm font-medium">{formatted.day}</p><p className="text-xs text-muted-foreground">{formatted.date}</p></div><Badge tone={event.status === "Absent" ? "red" : "amber"}>{event.status}</Badge></div>; })}</div> : <p className="p-5 text-center text-sm text-muted-foreground">No late arrivals or absences in this cycle.</p>}
              </section>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 py-4">
              <button className="rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted" onClick={() => void confirmEmployeeStatusChange(selectedEmployee, !selectedEmployee.isActive)} type="button">{selectedEmployee.isActive ? "Deactivate" : "Activate"}</button>
              <button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90" onClick={() => setSelectedEmployee(null)} type="button">Done</button>
            </div>
          </aside>
        </div>
      ) : null}
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
                    {openFilter === "all" ? "Filter employees" : `Filter by ${openFilter}`}
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

              {openFilter === "all" ? (
                <div className="space-y-3">
                  <Select
                    ariaLabel="Filter employees by shift"
                    menuMinWidth={248}
                    onChange={setShiftFilter}
                    options={shiftFilterOptions}
                    value={shiftFilter}
                  />
                  <Select
                    ariaLabel="Filter employees by status"
                    menuMinWidth={248}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "ACTIVE", label: "Active", indicatorClassName: "bg-emerald-500" },
                      { value: "INACTIVE", label: "Inactive", indicatorClassName: "bg-slate-400" },
                    ]}
                    value={statusFilter}
                  />
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-center text-xs font-semibold tabular-nums">
                    {formatMoney(salarySliderMinimumValue)} – {formatMoney(salarySliderMaximumValue)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground">Minimum<input aria-label="Minimum salary slider" className="mt-1 w-full accent-foreground" max={salarySliderMaximum} min="0" onChange={(event) => setMinimumSalary(event.target.value)} step="1000" type="range" value={salarySliderMinimumValue} /></label>
                    <label className="text-xs text-muted-foreground">Maximum<input aria-label="Maximum salary slider" className="mt-1 w-full accent-foreground" max={salarySliderMaximum} min={salarySliderMinimumValue} onChange={(event) => setMaximumSalary(event.target.value === String(salarySliderMaximum) ? "" : event.target.value)} step="1000" type="range" value={salarySliderMaximumValue} /></label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground">Minimum salary<input className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" min="0" onChange={(event) => setMinimumSalary(event.target.value)} placeholder="0" type="number" value={minimumSalary} /></label>
                    <label className="text-xs text-muted-foreground">Maximum salary<input className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" min="0" onChange={(event) => setMaximumSalary(event.target.value)} placeholder={String(salaryCeiling)} type="number" value={maximumSalary} /></label>
                  </div>
                </div>
              ) : null}

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
