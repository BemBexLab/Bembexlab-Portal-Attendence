"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useEmployees } from "@/hooks/use-attendance-data";

export default function EmployeesPage() {
  const employees = useEmployees();

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
                  <th className="px-4 py-3 font-medium">Role</th>
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
                      {employee.department}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {employee.role}
                    </td>
                    <td className="px-4 py-3">{employee.deviceUserId}</td>
                    <td className="px-4 py-3">
                      <Badge tone={employee.status === "ACTIVE" ? "green" : "neutral"}>
                        {employee.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
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
