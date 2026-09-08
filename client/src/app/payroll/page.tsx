"use client";

import { Pencil, Plus, Search, Trash2, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Swal from "sweetalert2";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useAllEmployeeLoans,
  useCreateEmployeeEarning,
  useCreateEmployeeLoan,
  useDeleteEmployeeLoan,
  useEmployees,
  useUpdateEmployeeLoan,
  useUpdateEmployeeSalary,
} from "@/hooks/use-attendance-data";
import type { Employee, EmployeeLoan } from "@/types/attendance";

function money(value: number | string) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function currentCycleMonth() {
  const date = new Date();
  if (date.getDate() < 26) date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
}

type LoanForm = {
  principalAmount: string;
  monthlyInstallment: string;
  startCycleMonth: string;
  numberOfInstallments: string;
  description: string;
  status: EmployeeLoan["status"];
};

const emptyLoanForm = (): LoanForm => ({
  principalAmount: "",
  monthlyInstallment: "",
  startCycleMonth: currentCycleMonth(),
  numberOfInstallments: "1",
  description: "",
  status: "ACTIVE",
});

export default function PayrollPage() {
  const employees = useEmployees();
  const loans = useAllEmployeeLoans();
  const updateSalary = useUpdateEmployeeSalary();
  const createLoan = useCreateEmployeeLoan();
  const updateLoan = useUpdateEmployeeLoan();
  const deleteLoan = useDeleteEmployeeLoan();
  const createEarning = useCreateEmployeeEarning();
  const [search, setSearch] = useState("");
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [allowanceDrafts, setAllowanceDrafts] = useState<Record<string, string>>({});
  const [loanEmployee, setLoanEmployee] = useState<Employee | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [loanForm, setLoanForm] = useState<LoanForm>(emptyLoanForm);

  useEffect(() => {
    if (!employees.data) return;
    setSalaryDrafts(
      Object.fromEntries(employees.data.map((employee) => [employee.id, employee.monthlySalary])),
    );
    setAllowanceDrafts(
      Object.fromEntries(employees.data.map((employee) => [employee.id, employee.allowance])),
    );
  }, [employees.data]);

  const loansByEmployee = useMemo(() => {
    const result = new Map<string, EmployeeLoan[]>();
    for (const loan of loans.data ?? []) {
      if (!loan.employee) continue;
      const current = result.get(loan.employee.id) ?? [];
      current.push(loan);
      result.set(loan.employee.id, current);
    }
    return result;
  }, [loans.data]);

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (employees.data ?? [])
      .filter(
        (employee) =>
          employee.isActive &&
          (!normalized ||
            employee.name.toLowerCase().includes(normalized) ||
            employee.employeeCode.toLowerCase().includes(normalized)),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [employees.data, search]);

  const saveCompensation = async (employee: Employee) => {
    const salary = Number(salaryDrafts[employee.id]);
    const allowance = Number(allowanceDrafts[employee.id]);
    if (!Number.isFinite(salary) || salary < 0 || !Number.isFinite(allowance) || allowance < 0) {
      await Swal.fire({ icon: "error", title: "Invalid amount", text: "Salary and allowance must be zero or greater." });
      return;
    }
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Save compensation?",
      text: `Update salary and allowance for ${employee.name}?`,
      showCancelButton: true,
      confirmButtonText: "Save",
      confirmButtonColor: "#171717",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await updateSalary.mutateAsync({ employeeId: employee.id, monthlySalary: salary, allowance });
      await Swal.fire({ icon: "success", title: "Saved", text: "Compensation was updated.", timer: 1200, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Could not save", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const openLoanForm = (employee: Employee, loan?: EmployeeLoan) => {
    setLoanEmployee(employee);
    setEditingLoan(loan ?? null);
    setLoanForm(
      loan
        ? {
            principalAmount: loan.principalAmount,
            monthlyInstallment: loan.monthlyInstallment,
            startCycleMonth: loan.startCycleMonth,
            numberOfInstallments: String(loan.numberOfInstallments),
            description: loan.description ?? "",
            status: loan.status,
          }
        : emptyLoanForm(),
    );
  };

  const saveLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loanEmployee) return;
    const values = {
      principalAmount: Number(loanForm.principalAmount),
      monthlyInstallment: Number(loanForm.monthlyInstallment),
      startCycleMonth: loanForm.startCycleMonth,
      numberOfInstallments: Number(loanForm.numberOfInstallments),
      description: loanForm.description,
      status: loanForm.status,
    };
    if (
      !Number.isFinite(values.principalAmount) || values.principalAmount <= 0 ||
      !Number.isFinite(values.monthlyInstallment) || values.monthlyInstallment <= 0 ||
      !/^\d{4}-\d{2}$/.test(values.startCycleMonth) ||
      !Number.isInteger(values.numberOfInstallments) || values.numberOfInstallments < 1
    ) {
      await Swal.fire({ icon: "error", title: "Invalid loan", text: "Enter valid loan amount, installment, start month, and installment count." });
      return;
    }
    const confirmation = await Swal.fire({
      icon: "question",
      title: editingLoan ? "Update loan?" : "Add loan?",
      text: `This will change payroll deductions for ${loanEmployee.name}.`,
      showCancelButton: true,
      confirmButtonText: editingLoan ? "Update" : "Add loan",
      confirmButtonColor: "#171717",
    });
    if (!confirmation.isConfirmed) return;
    try {
      if (editingLoan) {
        await updateLoan.mutateAsync({ employeeId: loanEmployee.id, loanId: editingLoan.id, ...values });
      } else {
        await createLoan.mutateAsync({
          employeeId: loanEmployee.id,
          principalAmount: values.principalAmount,
          monthlyInstallment: values.monthlyInstallment,
          startCycleMonth: values.startCycleMonth,
          numberOfInstallments: values.numberOfInstallments,
          description: values.description,
        });
      }
      setLoanEmployee(null);
      await Swal.fire({ icon: "success", title: "Saved", text: "Loan details were saved.", timer: 1200, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Could not save loan", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const removeLoan = async (employee: Employee, loan: EmployeeLoan) => {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Remove loan?",
      text: `Remove this loan from ${employee.name}'s payroll?`,
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteLoan.mutateAsync({ employeeId: employee.id, loanId: loan.id });
      await Swal.fire({ icon: "success", title: "Removed", timer: 1000, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Could not remove loan", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const addEarning = async (employee: Employee) => {
    const result = await Swal.fire({
      title: `Add earning · ${employee.name}`,
      html: `<input id="earning-type" class="swal2-input" value="BONUS" placeholder="BONUS or COMMISSION"><input id="earning-amount" class="swal2-input" type="number" min="0" step="0.01" placeholder="Amount"><input id="earning-percent" class="swal2-input" type="number" min="0" max="100" step="0.01" placeholder="Commission % (optional)"><input id="earning-description" class="swal2-input" placeholder="Description (optional)">`,
      showCancelButton: true,
      confirmButtonText: "Add earning",
      confirmButtonColor: "#171717",
      preConfirm: () => {
        const popup = Swal.getPopup();
        const type = popup?.querySelector<HTMLInputElement>("#earning-type")?.value.trim().toUpperCase();
        const amount = Number(popup?.querySelector<HTMLInputElement>("#earning-amount")?.value);
        const percentValue = popup?.querySelector<HTMLInputElement>("#earning-percent")?.value;
        const percentage = percentValue ? Number(percentValue) : undefined;
        if (type !== "BONUS" && type !== "COMMISSION") return Swal.showValidationMessage("Type must be BONUS or COMMISSION.");
        if (!Number.isFinite(amount) || amount < 0) return Swal.showValidationMessage("Enter a valid amount.");
        if (percentage !== undefined && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) return Swal.showValidationMessage("Percentage must be between 0 and 100.");
        return { type, amount, percentage, description: popup?.querySelector<HTMLInputElement>("#earning-description")?.value ?? "" };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    try {
      await createEarning.mutateAsync({ employeeId: employee.id, ...result.value, payrollCycleMonth: currentCycleMonth() });
      await Swal.fire({ icon: "success", title: "Earning added", timer: 1000, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Could not add earning", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <AppShell title="Payroll" description="Manage salary, allowance, earnings, and employee loan deductions.">
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><WalletCards className="size-5" /></div>
            <div><h2 className="text-sm font-semibold">Employee payroll controls</h2><p className="text-xs text-muted-foreground">Set recurring compensation and cycle-specific deductions from one place.</p></div>
          </div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none sm:w-64" onChange={(event) => setSearch(event.target.value)} placeholder="Search employee or code" value={search} /></div>
        </PanelHeader>
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Monthly salary</th><th className="px-4 py-3">Allowance</th><th className="px-4 py-3">Bonus / commission</th><th className="px-4 py-3">Loans</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((employee) => {
                  const employeeLoans = loansByEmployee.get(employee.id) ?? [];
                  const activeLoans = employeeLoans.filter((loan) => loan.status === "ACTIVE");
                  return <tr key={employee.id} className="align-top hover:bg-muted/30">
                    <td className="px-4 py-4"><p className="font-medium">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.employeeCode} · {employee.isActive ? "Active" : "Inactive"}</p></td>
                    <td className="px-4 py-4"><input className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm" type="number" min="0" value={salaryDrafts[employee.id] ?? employee.monthlySalary} onChange={(event) => setSalaryDrafts((current) => ({ ...current, [employee.id]: event.target.value }))} /></td>
                    <td className="px-4 py-4"><input className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm" type="number" min="0" value={allowanceDrafts[employee.id] ?? employee.allowance} onChange={(event) => setAllowanceDrafts((current) => ({ ...current, [employee.id]: event.target.value }))} /></td>
                    <td className="px-4 py-4"><p className="font-medium">Manage cycle earnings</p><p className="text-xs text-muted-foreground">Use the add button for bonus or commission.</p><Button className="mt-2" onClick={() => void addEarning(employee)} type="button" variant="secondary"><Plus className="size-4" /> Add earning</Button></td>
                    <td className="px-4 py-4"><p className="font-medium">{activeLoans.length ? `${activeLoans.length} active · ${money(activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment), 0))}/cycle` : "No active loan"}</p><div className="mt-2 space-y-1">{employeeLoans.map((loan) => <div className="flex items-center gap-2 text-xs" key={loan.id}><Badge tone={loan.status === "ACTIVE" ? "green" : "neutral"}>{loan.status}</Badge><span>{money(loan.monthlyInstallment)} × {loan.numberOfInstallments}</span><button aria-label="Edit loan" className="text-muted-foreground hover:text-foreground" onClick={() => openLoanForm(employee, loan)} type="button"><Pencil className="size-3" /></button><button aria-label="Remove loan" className="text-red-600" onClick={() => void removeLoan(employee, loan)} type="button"><Trash2 className="size-3" /></button></div>)}</div><Button className="mt-2" onClick={() => openLoanForm(employee)} type="button" variant="secondary"><Plus className="size-4" /> Add loan</Button></td>
                    <td className="px-4 py-4"><Button disabled={updateSalary.isPending} onClick={() => void saveCompensation(employee)} type="button"><Pencil className="size-4" /> Save compensation</Button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!employees.isLoading && !rows.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No employees found.</p> : null}
        </PanelBody>
      </Panel>

      {loanEmployee ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true"><form className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onSubmit={(event) => void saveLoan(event)}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{editingLoan ? "Edit loan" : "Add loan"}</h2><p className="text-sm text-muted-foreground">{loanEmployee.name} · {loanEmployee.employeeCode}</p></div><button aria-label="Close" className="rounded-md p-2 hover:bg-muted" onClick={() => setLoanEmployee(null)} type="button"><X className="size-4" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Principal amount<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" type="number" min="0.01" step="0.01" required value={loanForm.principalAmount} onChange={(event) => setLoanForm((current) => ({ ...current, principalAmount: event.target.value }))} /></label><label className="text-xs text-muted-foreground">Monthly installment<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" type="number" min="0.01" step="0.01" required value={loanForm.monthlyInstallment} onChange={(event) => setLoanForm((current) => ({ ...current, monthlyInstallment: event.target.value }))} /></label><label className="text-xs text-muted-foreground">Start payroll cycle<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" type="month" required value={loanForm.startCycleMonth} onChange={(event) => setLoanForm((current) => ({ ...current, startCycleMonth: event.target.value }))} /></label><label className="text-xs text-muted-foreground">Number of installments<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" type="number" min="1" step="1" required value={loanForm.numberOfInstallments} onChange={(event) => setLoanForm((current) => ({ ...current, numberOfInstallments: event.target.value }))} /></label><label className="text-xs text-muted-foreground">Status<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" disabled={!editingLoan} value={loanForm.status} onChange={(event) => setLoanForm((current) => ({ ...current, status: event.target.value as EmployeeLoan["status"] }))}><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select></label><label className="text-xs text-muted-foreground">Description (optional)<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={loanForm.description} onChange={(event) => setLoanForm((current) => ({ ...current, description: event.target.value }))} /></label></div><div className="mt-5 flex justify-end gap-2"><Button onClick={() => setLoanEmployee(null)} type="button" variant="secondary">Cancel</Button><Button disabled={createLoan.isPending || updateLoan.isPending} type="submit">{editingLoan ? "Update loan" : "Add loan"}</Button></div></form></div> : null}
    </AppShell>
  );
}
