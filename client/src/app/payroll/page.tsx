"use client";

import { CalendarDays, CheckCircle2, FileText, Pencil, Percent, Plus, Search, Sparkles, Trash2, WalletCards, X } from "lucide-react";
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
  useDeleteEmployeeEarning,
  useDeleteEmployeeLoan,
  useEmployeeEarnings,
  useEmployees,
  useUpdateEmployeeEarning,
  useUpdateEmployeeLoan,
  useUpdateEmployeeSalary,
} from "@/hooks/use-attendance-data";
import type { Employee, EmployeeEarning, EmployeeLoan } from "@/types/attendance";

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
  const updateEarning = useUpdateEmployeeEarning();
  const deleteEarning = useDeleteEmployeeEarning();
  const [search, setSearch] = useState("");
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [allowanceDrafts, setAllowanceDrafts] = useState<Record<string, string>>({});
  const [loanEmployee, setLoanEmployee] = useState<Employee | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [loanForm, setLoanForm] = useState<LoanForm>(emptyLoanForm);
  const [earningEmployee, setEarningEmployee] = useState<Employee | null>(null);
  const [editingEarning, setEditingEarning] = useState<EmployeeEarning | null>(null);
  const [earningType, setEarningType] = useState<EmployeeEarning["type"]>("BONUS");
  const [earningAmount, setEarningAmount] = useState("");
  const [earningPercentage, setEarningPercentage] = useState("");
  const [earningDescription, setEarningDescription] = useState("");
  const earningMonth = currentCycleMonth();
  const employeeEarnings = useEmployeeEarnings(earningEmployee?.id ?? "", earningMonth);

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

  const payrollSummary = useMemo(() => ({
    employees: rows.length,
    salary: rows.reduce((total, employee) => total + Number(employee.monthlySalary), 0),
    allowance: rows.reduce((total, employee) => total + Number(employee.allowance), 0),
    loans: rows.reduce(
      (total, employee) =>
        total + (loansByEmployee.get(employee.id) ?? [])
          .filter((loan) => loan.status === "ACTIVE")
          .reduce((sum, loan) => sum + Number(loan.monthlyInstallment), 0),
      0,
    ),
  }), [loansByEmployee, rows]);

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

  const openEarningForm = (employee: Employee, earning?: EmployeeEarning) => {
    setEarningEmployee(employee);
    setEditingEarning(earning ?? null);
    setEarningType(earning?.type ?? "BONUS");
    setEarningAmount(earning?.amount ?? "");
    setEarningPercentage(earning?.percentage ?? "");
    setEarningDescription(earning?.description ?? "");
  };

  const saveEarning = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!earningEmployee) return;
    const amount = Number(earningAmount);
    const percentage = earningPercentage.trim() ? Number(earningPercentage) : undefined;
    if (!Number.isFinite(amount) || amount <= 0) {
      await Swal.fire({ icon: "error", title: "Enter an amount", text: "The earning amount must be greater than zero." });
      return;
    }
    if (percentage !== undefined && (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)) {
      await Swal.fire({ icon: "error", title: "Invalid percentage", text: "Commission percentage must be between 0 and 100." });
      return;
    }
    try {
      if (editingEarning) {
        await updateEarning.mutateAsync({
          employeeId: earningEmployee.id,
          earningId: editingEarning.id,
          type: earningType,
          amount,
          percentage: earningType === "COMMISSION" ? percentage ?? null : null,
          payrollCycleMonth: earningMonth,
          description: earningDescription.trim() || null,
        });
      } else {
        await createEarning.mutateAsync({
          employeeId: earningEmployee.id,
          type: earningType,
          amount,
          percentage: earningType === "COMMISSION" ? percentage : undefined,
          payrollCycleMonth: earningMonth,
          description: earningDescription.trim() || undefined,
        });
      }
      setEditingEarning(null);
      setEarningAmount("");
      setEarningPercentage("");
      setEarningDescription("");
      await employeeEarnings.refetch();
      await Swal.fire({ icon: "success", title: editingEarning ? "Earning updated" : "Earning saved", text: "Saved to the VPS database for this payroll cycle.", timer: 1400, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: editingEarning ? "Could not update earning" : "Could not add earning", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const removeEarning = async (earning: EmployeeEarning) => {
    if (!earningEmployee) return;
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Remove earning?",
      text: `Remove this ${earning.type === "BONUS" ? "bonus" : "commission"} from ${earningEmployee.name}'s ${earningMonth} payroll cycle?`,
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteEarning.mutateAsync({ employeeId: earningEmployee.id, earningId: earning.id });
      if (editingEarning?.id === earning.id) setEditingEarning(null);
      await employeeEarnings.refetch();
      await Swal.fire({ icon: "success", title: "Earning removed", timer: 1100, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Could not remove earning", text: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <AppShell title="Payroll" description="Manage salary, allowance, earnings, and employee loan deductions.">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active employees", payrollSummary.employees, "text-slate-700 bg-slate-50"],
          ["Monthly salary", money(payrollSummary.salary), "text-emerald-700 bg-emerald-50"],
          ["Allowances", money(payrollSummary.allowance), "text-sky-700 bg-sky-50"],
          ["Loan installments", money(payrollSummary.loans), "text-amber-800 bg-amber-50"],
        ].map(([label, value, tone]) => (
          <div className={`rounded-xl border border-border px-4 py-3 shadow-sm ${tone}`} key={String(label)}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><WalletCards className="size-5" /></div>
            <div><h2 className="text-sm font-semibold">Employee payroll controls</h2><p className="text-xs text-muted-foreground">Set recurring compensation and cycle-specific deductions from one place.</p></div>
          </div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none sm:w-64" onChange={(event) => setSearch(event.target.value)} placeholder="Search employee or code" value={search} /></div>
        </PanelHeader>
        <PanelBody className="p-0">
        <div className="overflow-x-auto" data-table-scroll>
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
                    <td className="px-4 py-4"><p className="font-medium">Manage cycle earnings</p><p className="text-xs text-muted-foreground">Use the add button for bonus or commission.</p><Button className="mt-2" onClick={() => openEarningForm(employee)} type="button" variant="secondary"><Plus className="size-4" /> Add earning</Button></td>
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
      {earningEmployee ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <form className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto border border-border bg-card shadow-lg" onSubmit={(event) => void saveEarning(event)}>
            <div className="border-b border-border bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Sparkles className="size-5" /></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Payroll earning</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Add earning for {earningEmployee.name}</h2><p className="mt-1 text-sm text-muted-foreground">Employee {earningEmployee.employeeCode} · cycle {earningMonth}</p></div>
                </div>
                <button aria-label="Close" className="rounded-full border border-border bg-white p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => setEarningEmployee(null)} type="button"><X className="size-4" /></button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><CalendarDays className="size-4" /> Payroll cycle</div><p className="mt-2 font-semibold">{earningMonth}</p></div>
                <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:col-span-2"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" /> Saved earnings this cycle</div><p className="mt-2 font-semibold">{employeeEarnings.isLoading ? "Loading…" : `${employeeEarnings.data?.length ?? 0} earning${employeeEarnings.data?.length === 1 ? "" : "s"}`}</p></div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold">{editingEarning ? "Edit earning" : "New earning"}</h3><p className="text-xs text-muted-foreground">This record is saved directly to the VPS database.</p></div><Badge tone="green">{earningType === "BONUS" ? "Bonus" : "Commission"}</Badge></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">Earning type<select className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={earningType} onChange={(event) => { const type = event.target.value as EmployeeEarning["type"]; setEarningType(type); if (type === "BONUS") setEarningPercentage(""); }}><option value="BONUS">Bonus</option><option value="COMMISSION">Commission</option></select></label>
                  <label className="text-sm font-medium">Fixed amount<input className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" type="number" min="0.01" step="0.01" required value={earningAmount} onChange={(event) => setEarningAmount(event.target.value)} placeholder="e.g. 15000" /></label>
                  {earningType === "COMMISSION" ? <label className="text-sm font-medium">Commission percentage <span className="font-normal text-muted-foreground">(optional)</span><div className="relative mt-1.5"><Percent className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" type="number" min="0.01" max="100" step="0.01" value={earningPercentage} onChange={(event) => setEarningPercentage(event.target.value)} placeholder="e.g. 5" /></div></label> : null}
                  <label className="text-sm font-medium sm:col-span-2">Description <span className="font-normal text-muted-foreground">(optional)</span><div className="relative mt-1.5"><FileText className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><input className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm" value={earningDescription} onChange={(event) => setEarningDescription(event.target.value)} placeholder="What is this earning for?" /></div></label>
                </div>
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900"><p className="font-medium">How earnings work</p><p className="mt-1 text-xs leading-5 text-sky-800">Earnings are added to this employee’s selected payroll cycle and are included in the payable salary after saving.</p></div>
              {employeeEarnings.data?.length ? <div><h3 className="mb-2 text-sm font-semibold">Already saved for {earningMonth}</h3><div className="divide-y divide-border rounded-2xl border border-border">{employeeEarnings.data.map((earning) => <div className="flex items-center justify-between gap-4 px-4 py-3" key={earning.id}><div><p className="font-medium">{earning.type === "BONUS" ? "Bonus" : "Commission"}</p><p className="text-xs text-muted-foreground">{earning.description || "No description"}{earning.percentage ? ` · ${earning.percentage}%` : ""}</p></div><div className="flex items-center gap-3 text-right"><div><p className="font-semibold text-emerald-700">{money(earning.amount)}</p><Badge tone={earning.status === "CANCELLED" ? "red" : earning.status === "PAID" ? "blue" : "green"}>{earning.status}</Badge></div><div className="flex items-center gap-1"><button aria-label={`Edit ${earning.type === "BONUS" ? "bonus" : "commission"}`} className="grid size-8 place-items-center border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => openEarningForm(earningEmployee, earning)} type="button"><Pencil className="size-4" /></button><button aria-label={`Remove ${earning.type === "BONUS" ? "bonus" : "commission"}`} className="grid size-8 place-items-center border border-red-200 text-red-600 transition hover:bg-red-50" disabled={deleteEarning.isPending} onClick={() => void removeEarning(earning)} type="button"><Trash2 className="size-4" /></button></div></div></div>)}</div></div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/20 px-6 py-4"><Button onClick={() => setEarningEmployee(null)} type="button" variant="secondary">Done</Button><Button disabled={createEarning.isPending || updateEarning.isPending} type="submit">{editingEarning ? <Pencil className="size-4" /> : <Plus className="size-4" />} {createEarning.isPending || updateEarning.isPending ? "Saving…" : editingEarning ? "Update earning" : "Add earning"}</Button></div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
