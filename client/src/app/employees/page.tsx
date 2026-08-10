"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useEmployees,
  useUpdateEmployeeStatus,
} from "@/hooks/use-attendance-data";

export default function EmployeesPage() {
  const employees = useEmployees();
  const updateStatus = useUpdateEmployeeStatus();
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  return (
    <AppShell
      description="Employee roster mapped to biometric device users."
      title="Employees"
    >
      <Panel>
        <PanelHeader>
          <div>
            <h2 className="text-sm font-semibold">Employee directory</h2>
            <p className="text-xs text-muted-foreground">
              Device user IDs are used for raw punch matching.
            </p>
          </div>
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
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(employees.data ?? []).map((employee) => (
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
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
