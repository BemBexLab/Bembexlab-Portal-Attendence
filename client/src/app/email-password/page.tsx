"use client";

import axios from "axios";
import { KeyRound, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useEmployeeCredentials,
  useUpdateEmployeeCredentials,
} from "@/hooks/use-attendance-data";
import type { EmployeeCredential } from "@/types/attendance";

type CredentialDraft = {
  email: string;
  password: string;
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(" ") : message ?? error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
}

export default function EmailPasswordPage() {
  const credentials = useEmployeeCredentials();
  const updateCredentials = useUpdateEmployeeCredentials();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CredentialDraft>>({});
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (!credentials.data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const employee of credentials.data) {
        if (!next[employee.employeeId]) {
          next[employee.employeeId] = {
            email: employee.email ?? "",
            password: "",
          };
        }
      }
      return next;
    });
  }, [credentials.data]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (credentials.data ?? []).filter(
      (employee) =>
        !term ||
        employee.name.toLowerCase().includes(term) ||
        employee.employeeCode.toLowerCase().includes(term),
    );
  }, [credentials.data, search]);

  const updateDraft = (
    employeeId: string,
    field: keyof CredentialDraft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [employeeId]: {
        email: current[employeeId]?.email ?? "",
        password: current[employeeId]?.password ?? "",
        [field]: value,
      },
    }));
  };

  const saveCredentials = async (employee: EmployeeCredential) => {
    const draft = drafts[employee.employeeId] ?? { email: "", password: "" };
    const email = draft.email.trim().toLowerCase();
    const password = draft.password;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await Swal.fire({
        title: "Enter a valid email",
        text: `${employee.name} needs a valid email address before saving.`,
        icon: "warning",
        confirmButtonColor: "#171717",
      });
      return;
    }
    if (!employee.hasPassword && password.length < 8) {
      await Swal.fire({
        title: "Password required",
        text: "A new employee login must have a password of at least 8 characters.",
        icon: "warning",
        confirmButtonColor: "#171717",
      });
      return;
    }
    if (password && password.length < 8) {
      await Swal.fire({
        title: "Password is too short",
        text: "Passwords must contain at least 8 characters.",
        icon: "warning",
        confirmButtonColor: "#171717",
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: employee.hasPassword ? "Update login details?" : "Create login details?",
      text: `Save the email and password for ${employee.name} (${employee.employeeCode})? The password will be securely hashed in the VPS database.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: employee.hasPassword ? "Update credentials" : "Create credentials",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed || savingEmployeeId) return;

    setSavingEmployeeId(employee.employeeId);
    try {
      await updateCredentials.mutateAsync({
        employeeId: employee.employeeId,
        email,
        ...(password ? { password } : {}),
      });
      setDrafts((current) => ({
        ...current,
        [employee.employeeId]: { email, password: "" },
      }));
      await Swal.fire({
        title: "Credentials saved",
        text: `${employee.name}'s login details are now saved in the VPS database.`,
        icon: "success",
        timer: 1700,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({
        title: "Could not save credentials",
        text: getErrorMessage(error),
        icon: "error",
        confirmButtonColor: "#171717",
      });
    } finally {
      setSavingEmployeeId(null);
    }
  };

  return (
    <AppShell
      description="Assign individual employee login credentials."
      title="Email / Password"
    >
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Employee login credentials</h2>
              <p className="text-xs text-muted-foreground">
                Each login is linked to its employee code. Passwords are hashed and never displayed.
              </p>
            </div>
          </div>
          <label className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search employees by name or code"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or employee code"
              value={search}
            />
          </label>
        </PanelHeader>
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">S.No</th>
                  <th className="px-4 py-3 font-medium">Employee code</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Password</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((employee, index) => {
                  const draft = drafts[employee.employeeId] ?? {
                    email: employee.email ?? "",
                    password: "",
                  };
                  return (
                    <tr className="hover:bg-muted/40" key={employee.employeeId}>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{employee.employeeCode}</td>
                      <td className="px-4 py-3 font-medium">{employee.name}</td>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Email for ${employee.name}`}
                          className="h-10 w-full min-w-[230px] rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                          onChange={(event) => updateDraft(employee.employeeId, "email", event.target.value)}
                          placeholder="employee@example.com"
                          type="email"
                          value={draft.email}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Password for ${employee.name}`}
                          className="h-10 w-full min-w-[190px] rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                          onChange={(event) => updateDraft(employee.employeeId, "password", event.target.value)}
                          placeholder={employee.hasPassword ? "Enter new password" : "Minimum 8 characters"}
                          type="password"
                          value={draft.password}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={employee.hasPassword ? "green" : "neutral"}>
                          {employee.hasPassword ? "Configured" : "Not configured"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          disabled={savingEmployeeId !== null}
                          onClick={() => void saveCredentials(employee)}
                          type="button"
                          variant="primary"
                        >
                          <Save className="size-4" />
                          {savingEmployeeId === employee.employeeId ? "Saving..." : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!credentials.isLoading && !filteredEmployees.length ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {search ? "No employees match your search." : "No employees found."}
            </p>
          ) : null}
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
