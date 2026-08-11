"use client";

import { CalendarDays, Download, Search, WalletCards, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { usePayrollReport } from "@/hooks/use-reports";
import { downloadCsv } from "@/lib/csv";
import type { PayrollRow } from "@/types/attendance";

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function PayrollReportPanel() {
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollRow | null>(null);
  const payroll = usePayrollReport(month || undefined);
  const report = payroll.data;
  const filteredRows = (report?.rows ?? []).filter((row) => {
    const query = search.toLowerCase().trim();
    return (
      !query ||
      row.employee.toLowerCase().includes(query) ||
      row.employeeCode.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (!month && report?.month) {
      setMonth(report.month);
    }
  }, [month, report?.month]);

  const exportPayroll = () => {
    if (!report?.rows.length) {
      return;
    }

    downloadCsv(
      `payroll-${report.month}.csv`,
      report.rows.map((row) => ({
        employeeCode: row.employeeCode,
        employee: row.employee,
        department: row.department,
        monthlySalary: row.monthlySalary,
        workingDays: row.workingDays,
        presentDays: row.presentDays,
        dailyRate: row.dailyRate,
        absentDays: row.absentDays,
        halfDays: row.halfDays,
        halfDayDeductionDays: row.halfDayDeductionDays,
        totalDeductionDays: row.totalDeductionDays,
        deductionAmount: row.deductionAmount,
        payableSalary: row.payableSalary,
        absentDates: row.attendanceDetails
          .filter((detail) => detail.status === "ABSENT")
          .map((detail) => `${detail.date} (${detail.day})`)
          .join("; "),
        halfDayDates: row.attendanceDetails
          .filter((detail) => detail.status === "HALF_DAY")
          .map((detail) => `${detail.date} (${detail.day})`)
          .join("; "),
      })),
    );
  };

  return (
    <>
    <Panel className="overflow-hidden">
      <PanelHeader className="flex-col items-stretch lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <WalletCards className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Monthly payroll</h2>
            <p className="text-xs text-muted-foreground">
              Cycle: 25th to the following month&apos;s 25th. Weekends are off.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs text-muted-foreground">
            Find employee
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20 sm:w-48"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or code"
                value={search}
              />
            </span>
          </label>
          <label className="text-xs text-muted-foreground">
            Cycle starting month
            <input
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
          <Button
            disabled={!report?.rows.length}
            onClick={exportPayroll}
            type="button"
            variant="secondary"
          >
            <Download className="size-4" />
            Payroll CSV
          </Button>
        </div>
      </PanelHeader>

      <PanelBody className="p-0">
        <div className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
          {[
            ["Gross salary", report ? money(report.summary.grossSalary) : "-"],
            ["Deductions", report ? money(report.summary.deductions) : "-"],
            ["Payable salary", report ? money(report.summary.payableSalary) : "-"],
          ].map(([label, value]) => (
            <div className="bg-card px-4 py-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Monthly salary</th>
                <th className="px-4 py-3 font-medium">Working days</th>
                <th className="px-4 py-3 font-medium">Daily rate</th>
                <th className="px-4 py-3 font-medium">Absent</th>
                <th className="px-4 py-3 font-medium">Half days</th>
                <th className="px-4 py-3 font-medium">Total deduction days</th>
                <th className="px-4 py-3 font-medium">Deduction</th>
                <th className="px-4 py-3 font-medium">Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => (
                <tr
                  className="cursor-pointer hover:bg-muted/40"
                  key={row.employeeId}
                  onClick={() => setSelectedEmployee(row)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedEmployee(row);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.employee}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeCode} · {row.department}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{money(row.monthlySalary)}</td>
                  <td className="px-4 py-3 tabular-nums">{row.workingDays}</td>
                  <td className="px-4 py-3 tabular-nums">{money(row.dailyRate)}</td>
                  <td className="px-4 py-3 tabular-nums">{row.absentDays}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.halfDays}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.halfDayDeductionDays} day deduction)
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <p className="font-medium">{row.totalDeductionDays}</p>
                    <p className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.absentDays} absent + {row.halfDayDeductionDays} half-day
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-red-600">
                    {money(row.deductionAmount)}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700">
                    {money(row.payableSalary)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report ? (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Cycle {report.cycleStart} to {report.cycleEnd} · {report.workingDays} weekday working days · attendance assessed through {report.calculatedThrough ?? "not started"}. Each absence deducts 1 day; every 3 half days deduct 1 additional day.
          </div>
        ) : null}
      </PanelBody>
    </Panel>

    {selectedEmployee && report ? (
      <div
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) {
            setSelectedEmployee(null);
          }
        }}
        role="dialog"
      >
        <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payroll details · {report.cycleStart} to {report.cycleEnd}
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold">
                {selectedEmployee.employee}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedEmployee.employeeCode} · {selectedEmployee.department}
              </p>
            </div>
            <button
              aria-label="Close employee payroll details"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted"
              onClick={() => setSelectedEmployee(null)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total working days", selectedEmployee.workingDays],
                ["Total present days", selectedEmployee.presentDays],
                ["Total absent days", selectedEmployee.absentDays],
                ["Total half days", selectedEmployee.halfDays],
                ["Total deduction days", selectedEmployee.totalDeductionDays],
                ["Gross salary", money(selectedEmployee.monthlySalary)],
                ["Deduction amount", money(selectedEmployee.deductionAmount)],
                ["Final amount", money(selectedEmployee.payableSalary)],
              ].map(([label, value]) => (
                <div className="rounded-xl border border-border bg-muted/25 p-3.5" key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <CalendarDays className="size-4 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">Attendance exceptions</h3>
                  <p className="text-xs text-muted-foreground">
                    Absent and half-day dates in this payroll cycle.
                  </p>
                </div>
              </div>
              {selectedEmployee.attendanceDetails.length ? (
                <div className="divide-y divide-border">
                  {selectedEmployee.attendanceDetails.map((detail) => (
                    <div
                      className="flex items-center justify-between gap-4 px-4 py-3"
                      key={`${detail.date}-${detail.status}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{detail.date}</p>
                        <p className="text-xs text-muted-foreground">{detail.day}</p>
                      </div>
                      <span
                        className={
                          detail.status === "ABSENT"
                            ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                            : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                        }
                      >
                        {detail.status === "ABSENT" ? "Absent" : "Half Day"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No absences or half days in this cycle.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
