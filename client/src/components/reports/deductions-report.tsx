"use client";

import { CalendarDays, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDeductionsReport } from "@/hooks/use-reports";

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function DeductionsReportPanel() {
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const deductions = useDeductionsReport(month || undefined);
  const report = deductions.data;
  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();
    return (report?.rows ?? []).filter(
      (row) =>
        !query ||
        row.employee.toLowerCase().includes(query) ||
        row.employeeCode.toLowerCase().includes(query) ||
        row.department.toLowerCase().includes(query),
    );
  }, [report?.rows, search]);

  return (
    <Panel>
      <PanelHeader className="flex-col items-stretch lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
            <CalendarDays className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Deductions</h2>
            <p className="text-xs text-muted-foreground">
              A late arrival is a half day. Every 3 half days equal 1 deduction day.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs text-muted-foreground">
            Find employee
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20 sm:w-48"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or code"
                value={search}
              />
            </span>
          </label>
          <label className="text-xs text-muted-foreground">
            Payroll cycle month
            <input
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month || report?.month || ""}
            />
          </label>
        </div>
      </PanelHeader>

      <PanelBody className="p-0">
        <div className="grid gap-px border-b border-border bg-border sm:grid-cols-4">
          {[
            ["Employees", report ? String(report.summary.employees) : "-"],
            ["Total deduction days", report ? String(report.summary.totalDeductionDays) : "-"],
            ["Half-day deductions", report ? String(report.summary.totalHalfDayDeductionDays) : "-"],
            ["Total deduction amount", report ? money(report.summary.totalDeductionAmount) : "-"],
          ].map(([label, value]) => (
            <div className="bg-card px-4 py-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Half days</th>
                <th className="px-4 py-3 font-medium">Absent days</th>
                <th className="px-4 py-3 font-medium">Half-day deduction</th>
                <th className="px-4 py-3 font-medium">Total deduction days</th>
                <th className="px-4 py-3 font-medium">Deduction amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => (
                <tr className="hover:bg-muted/40" key={row.employeeId}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.employee}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.employeeCode}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.department}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.halfDays}</td>
                  <td className="px-4 py-3 tabular-nums">{row.absentDays}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.halfDayDeductionDays}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {row.totalDeductionDays}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-red-600">
                    {money(row.deductionAmount)}
                  </td>
                </tr>
              ))}
              {!filteredRows.length && !deductions.isLoading ? (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                    colSpan={7}
                  >
                    No deductions recorded for this cycle.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {report ? (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Cycle {report.month} · calculated through{" "}
            {report.rows[0]?.calculatedThrough ?? "not started"}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
