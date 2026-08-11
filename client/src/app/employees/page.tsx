"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useEmployees,
  useUpdateEmployeeSalary,
  useUpdateEmployeeStatus,
} from "@/hooks/use-attendance-data";

export default function EmployeesPage() {
  const employees = useEmployees();
  const updateStatus = useUpdateEmployeeStatus();
  const updateSalary = useUpdateEmployeeSalary();
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const filteredEmployees = (employees.data ?? []).filter((employee) => {
    const query = search.toLowerCase().trim();
    return (
      !query ||
      employee.name.toLowerCase().includes(query) ||
      employee.employeeCode.toLowerCase().includes(query)
    );
  });

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
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Device User ID</th>
                  <th className="px-4 py-3 font-medium">Monthly Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((employee) => (
                  <tr className="hover:bg-muted/40" key={employee.id}>
                    <td className="px-4 py-3 font-medium">
                      {employee.employeeCode}
                    </td>
                    <td className="px-4 py-3">{employee.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {employee.department ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      {employee.deviceUserId ?? "Not assigned"}
                    </td>
                    <td className="px-4 py-3">
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
                            updateSalary.isPending ||
                            salaryDrafts[employee.id] === undefined ||
                            salaryDrafts[employee.id] === employee.monthlySalary ||
                            Number(salaryDrafts[employee.id]) < 0
                          }
                          onClick={() => {
                            const value = Number(salaryDrafts[employee.id]);

                            if (!Number.isFinite(value) || value < 0) {
                              return;
                            }

                            updateSalary.mutate({
                              employeeId: employee.id,
                              monthlySalary: value,
                            }, {
                              onSuccess: () =>
                                setSalaryDrafts((current) => {
                                  const next = { ...current };
                                  delete next[employee.id];
                                  return next;
                                }),
                            });
                          }}
                          type="button"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <button
                          aria-expanded={openStatusId === employee.id}
                          aria-haspopup="menu"
                          aria-label={`Change ${employee.name}'s employee status`}
                          className="inline-flex items-center gap-1 rounded-md outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-wait disabled:opacity-60"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            setOpenStatusId((current) =>
                              current === employee.id ? null : employee.id,
                            )
                          }
                          type="button"
                        >
                          <Badge
                            tone={employee.isActive ? "green" : "neutral"}
                          >
                            {employee.isActive ? "Active" : "In-Active"}
                          </Badge>
                          <ChevronDown className="size-3 text-muted-foreground" />
                        </button>
                        {openStatusId === employee.id ? (
                          <div
                            className="absolute right-0 z-30 mt-1 min-w-32 space-y-1 rounded-md border border-border bg-background p-1.5 shadow-lg"
                            role="menu"
                          >
                            {[
                              { label: "Active", value: true },
                              { label: "In-Active", value: false },
                            ].map((status) => (
                              <button
                                className="flex w-full items-center rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                                disabled={status.value === employee.isActive}
                                key={status.label}
                                onClick={() => {
                                  setOpenStatusId(null);
                                  updateStatus.mutate({
                                    employeeId: employee.id,
                                    isActive: status.value,
                                  });
                                }}
                                role="menuitem"
                                type="button"
                              >
                                <Badge tone={status.value ? "green" : "neutral"}>
                                  {status.label}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        ) : null}
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
