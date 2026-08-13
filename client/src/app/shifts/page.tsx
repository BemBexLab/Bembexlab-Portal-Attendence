"use client";

import { Clock4, Pencil, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import Swal from "sweetalert2";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { TimeInput } from "@/components/ui/time-input";
import { useAssignEmployeeShift, useCreateShift, useDeleteShift, useEmployees, useShifts, useUpdateShift } from "@/hooks/use-attendance-data";

function toMinutes(value: string) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }
function toTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")} ${hour24 >= 12 ? "PM" : "AM"}`;
}
function timeFields(id: string, label: string, minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? "PM" : "AM";
  return `<div style="display:flex;min-width:0;flex-direction:column;gap:8px;text-align:left">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <label style="font-size:13px;font-weight:600;color:#374151" for="${id}-hour">${label}</label>
      <span style="font-size:11px;color:#9ca3af">12-hour format</span>
    </div>
    <div style="display:grid;grid-template-columns:minmax(62px,1fr) auto minmax(62px,1fr) 96px;align-items:center;gap:8px">
      <input id="${id}-hour" aria-label="${label} hour" inputmode="numeric" maxlength="2" value="${String(hour12).padStart(2, "0")}" style="height:46px;width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:0 10px;text-align:center;font-size:16px;outline:none">
      <span style="font-size:18px;font-weight:600;color:#6b7280">:</span>
      <input id="${id}-minute" aria-label="${label} minute" inputmode="numeric" maxlength="2" value="${String(minutes % 60).padStart(2, "0")}" style="height:46px;width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:0 10px;text-align:center;font-size:16px;outline:none">
      <div class="shift-period" style="display:grid;height:46px;grid-template-columns:1fr 1fr;overflow:hidden;border:1px solid #d1d5db;border-radius:8px;background:#fff;padding:3px">
        <label><input name="${id}-period" type="radio" value="AM"${period === "AM" ? " checked" : ""}><span>AM</span></label>
        <label><input name="${id}-period" type="radio" value="PM"${period === "PM" ? " checked" : ""}><span>PM</span></label>
      </div>
    </div>
  </div>`;
}

export default function ShiftsPage() {
  const shifts = useShifts();
  const employees = useEmployees();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const assignShift = useAssignEmployeeShift();
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const selectedEmployee = (employees.data ?? []).find((employee) => employee.id === employeeId);
  const matchingEmployees = (employees.data ?? []).filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    return employee.isActive && (!query || employee.name.toLowerCase().includes(query) || employee.employeeCode.toLowerCase().includes(query));
  });
  const showAssignedEmployees = async (shift: NonNullable<typeof shifts.data>[number]) => {
    const assigned = (employees.data ?? []).filter((employee) => employee.shift?.id === shift.id);
    await Swal.fire({
      title: shift.name,
      html: assigned.length ? `
        <div style="overflow:hidden;border:1px solid #e5e7eb;border-radius:10px;text-align:left">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 110px;padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em"><span>Employee</span><span>Department</span></div>
          ${assigned.map((employee) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 110px;align-items:center;gap:12px;padding:12px 14px;border-top:1px solid #e5e7eb"><div style="min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#111827;font-size:14px;font-weight:600">${escapeHtml(employee.name)}</div><div style="margin-top:2px;color:#6b7280;font-size:12px">${escapeHtml(employee.employeeCode)}${employee.isActive ? "" : " · Inactive"}</div></div><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280;font-size:12px">${escapeHtml(employee.department ?? "Unassigned")}</div></div>`).join("")}
        </div>` : `<div style="border:1px dashed #d1d5db;border-radius:10px;padding:32px 16px;color:#6b7280;font-size:14px">No employees are currently assigned to this shift.</div>`,
      text: undefined,
      width: 620,
      confirmButtonText: "Close",
      confirmButtonColor: "#171717",
      footer: `${assigned.length} employee${assigned.length === 1 ? "" : "s"} assigned`,
    });
  };
  const confirmAction = async (title: string, text: string, confirmButtonText: string) => {
    const result = await Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
    });
    return result.isConfirmed;
  };
  const createNewShift = async () => {
    const confirmed = await confirmAction(
      "Create this shift?",
      `${name.trim()} will run from ${toTime(toMinutes(start))} to ${toTime(toMinutes(end))} with a 15-minute grace period. Are you sure you want to continue?`,
      "Create shift",
    );
    if (!confirmed) return;
    try {
      await createShift.mutateAsync({ name, startMinutes: toMinutes(start), endMinutes: toMinutes(end) });
      setName("");
      await Swal.fire({ title: "Shift created", icon: "success", timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire({ title: "Could not create shift", text: "The shift name may already be in use.", icon: "error" });
    }
  };
  const toggleShift = async (shift: NonNullable<typeof shifts.data>[number]) => {
    const action = shift.isActive ? "deactivate" : "activate";
    const confirmed = await confirmAction(
      `${shift.isActive ? "Deactivate" : "Activate"} ${shift.name}?`,
      `Are you sure you want to ${action} this shift?`,
      shift.isActive ? "Deactivate" : "Activate",
    );
    if (!confirmed) return;
    try {
      await updateShift.mutateAsync({ id: shift.id, isActive: !shift.isActive });
      await Swal.fire({ title: `Shift ${shift.isActive ? "deactivated" : "activated"}`, icon: "success", timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire({ title: `Could not ${action} shift`, icon: "error" });
    }
  };
  const removeShift = async (shift: NonNullable<typeof shifts.data>[number]) => {
    const result = await Swal.fire({
      title: `Delete ${shift.name}?`,
      text: shift._count.assignments
        ? `This will also remove ${shift._count.assignments} employee shift assignment${shift._count.assignments === 1 ? "" : "s"}. Existing attendance records will be preserved.`
        : "Existing attendance records will be preserved.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete shift",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    try {
      await deleteShift.mutateAsync(shift.id);
      if (shiftId === shift.id) setShiftId("");
      await Swal.fire({ title: "Shift deleted", icon: "success", timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire({ title: "Could not delete shift", text: "Please try again.", icon: "error" });
    }
  };
  const editShift = async (shift: NonNullable<typeof shifts.data>[number]) => {
    const result = await Swal.fire<{ name: string; start: string; end: string }>({
      title: "Update shift",
      html: `
        <style>
          .shift-period label { display:flex; min-width:0; cursor:pointer; }
          .shift-period input { position:absolute; opacity:0; pointer-events:none; }
          .shift-period span { display:flex; width:100%; align-items:center; justify-content:center; border-radius:5px; color:#6b7280; font-size:12px; font-weight:700; transition:all .15s ease; }
          .shift-period label:hover span { background:#f3f4f6; color:#111827; }
          .shift-period input:checked + span { background:#171717; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.14); }
          @media (max-width: 620px) { .shift-times { grid-template-columns:1fr !important; } }
        </style>
        <div style="display:flex;flex-direction:column;gap:22px;margin-top:4px">
          <div style="display:flex;flex-direction:column;gap:7px;text-align:left">
            <label style="font-size:13px;font-weight:600;color:#374151" for="edit-shift-name">Shift name</label>
            <input id="edit-shift-name" autocomplete="off" style="height:44px;border:1px solid #d1d5db;border-radius:8px;padding:0 13px;font-size:15px;outline:none;width:100%;box-sizing:border-box">
          </div>
          <div class="shift-times" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px">
            ${timeFields("edit-shift-start", "Start time", shift.startMinutes)}
            ${timeFields("edit-shift-end", "End time", shift.endMinutes)}
          </div>
          <p style="margin:0;border-radius:8px;background:#f3f4f6;padding:10px 12px;text-align:left;font-size:12px;color:#6b7280">The 15-minute grace period is applied automatically.</p>
        </div>
      `,
      width: 680,
      showCancelButton: true,
      confirmButtonText: "Save changes",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      focusConfirm: false,
      customClass: {
        popup: "rounded-xl",
        title: "text-2xl",
        actions: "mt-5",
        cancelButton: "border border-input !bg-background !text-foreground",
      },
      confirmButtonColor: "#171717",
      didOpen: () => {
        (document.querySelector("#edit-shift-name") as HTMLInputElement).value = shift.name;
      },
      preConfirm: () => {
        const name = (document.querySelector("#edit-shift-name") as HTMLInputElement).value.trim();
        const startHour = Number((document.querySelector("#edit-shift-start-hour") as HTMLInputElement).value);
        const startMinute = Number((document.querySelector("#edit-shift-start-minute") as HTMLInputElement).value);
        const endHour = Number((document.querySelector("#edit-shift-end-hour") as HTMLInputElement).value);
        const endMinute = Number((document.querySelector("#edit-shift-end-minute") as HTMLInputElement).value);
        const startPeriod = (document.querySelector('input[name="edit-shift-start-period"]:checked') as HTMLInputElement).value;
        const endPeriod = (document.querySelector('input[name="edit-shift-end-period"]:checked') as HTMLInputElement).value;
        if (!name) {
          Swal.showValidationMessage("Enter a shift name.");
          return false;
        }
        if (![startHour, startMinute, endHour, endMinute].every(Number.isInteger) || startHour < 1 || startHour > 12 || endHour < 1 || endHour > 12 || startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
          Swal.showValidationMessage("Enter valid times (hours 01–12 and minutes 00–59).");
          return false;
        }
        const startHour24 = startHour % 12 + (startPeriod === "PM" ? 12 : 0);
        const endHour24 = endHour % 12 + (endPeriod === "PM" ? 12 : 0);
        const start = `${String(startHour24).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
        const end = `${String(endHour24).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
        if (start === end) {
          Swal.showValidationMessage("Start and end times must differ.");
          return false;
        }
        return { name, start, end };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    const confirmed = await confirmAction(
      "Save these changes?",
      `Are you sure you want to update ${shift.name}?`,
      "Update shift",
    );
    if (!confirmed) return;
    try {
      await updateShift.mutateAsync({
        id: shift.id,
        name: result.value.name,
        startMinutes: toMinutes(result.value.start),
        endMinutes: toMinutes(result.value.end),
      });
      await Swal.fire({ title: "Shift updated", icon: "success", timer: 1400, showConfirmButton: false });
    } catch {
      await Swal.fire({ title: "Could not update shift", text: "The name may already be in use.", icon: "error" });
    }
  };

  return <AppShell title="Shifts" description="Create working schedules and assign them to employees.">
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel>
        <PanelHeader><div><h2 className="text-sm font-semibold">Shift categories</h2><p className="text-xs text-muted-foreground">Every shift has a fixed 15-minute arrival grace period.</p></div><Clock4 className="size-4 text-muted-foreground" /></PanelHeader>
        <PanelBody className="space-y-4">
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">Shift name<input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Morning Shift" /></label>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-xs text-muted-foreground">Start time<span className="mt-1 block min-w-0"><TimeInput ariaLabel="Start time" onChange={setStart} value={start} /></span></label>
              <label className="min-w-0 text-xs text-muted-foreground">End time<span className="mt-1 block min-w-0"><TimeInput ariaLabel="End time" onChange={setEnd} value={end} /></span></label>
            </div>
          </div>
          <Button className="w-full" variant="primary" disabled={!name.trim() || createShift.isPending || start === end} onClick={() => void createNewShift()} type="button">Create shift</Button>
          {(shifts.data ?? []).length ? <div className="space-y-2">
            {(shifts.data ?? []).map((shift) => { const assignedCount = (employees.data ?? []).filter((employee) => employee.shift?.id === shift.id).length; return <div aria-label={`View employees assigned to ${shift.name}`} className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-background p-3.5 transition hover:border-foreground/30 hover:bg-muted/20 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/20 sm:flex-row sm:items-center sm:justify-between" key={shift.id} onClick={() => void showAssignedEmployees(shift)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void showAssignedEmployees(shift); } }} role="button" tabIndex={0}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Clock4 className="size-4 text-muted-foreground" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{shift.name}</p><Badge tone={shift.isActive ? "green" : "neutral"}>{shift.isActive ? "Active" : "Inactive"}</Badge></div>
                  <p className="mt-1 text-sm font-medium text-foreground">{toTime(shift.startMinutes)} <span className="px-1 text-muted-foreground">→</span> {toTime(shift.endMinutes)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>Grace until {toTime(shift.startMinutes + 15)}</span><span>{assignedCount} employee assignment{assignedCount === 1 ? "" : "s"}</span></div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t border-border pt-3 sm:border-0 sm:pt-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <Button className="mr-auto sm:mr-0" disabled={updateShift.isPending} type="button" onClick={() => void toggleShift(shift)}>{shift.isActive ? "Deactivate" : "Activate"}</Button>
                <Button aria-label={`Edit ${shift.name}`} className="size-9 p-0" disabled={updateShift.isPending} onClick={() => void editShift(shift)} title="Edit shift" type="button"><Pencil className="size-4" /></Button>
                <Button aria-label={`Delete ${shift.name}`} className="size-9 p-0 text-destructive hover:text-destructive" disabled={deleteShift.isPending} onClick={() => void removeShift(shift)} title="Delete shift" type="button"><Trash2 className="size-4" /></Button>
              </div>
            </div>; })}
          </div> : null}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader><div><h2 className="text-sm font-semibold">Assign employee shift</h2><p className="text-xs text-muted-foreground">The new schedule applies from the selected date.</p></div></PanelHeader>
        <PanelBody className="space-y-3">
          <div className="relative block text-xs text-muted-foreground">
            <label htmlFor="shift-employee-search">Employee</label>
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                aria-controls="shift-employee-suggestions"
                aria-expanded={Boolean(employeeSearch.trim() && !selectedEmployee)}
                autoComplete="off"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
                id="shift-employee-search"
                onChange={(event) => {
                  setEmployeeSearch(event.target.value);
                  setEmployeeId("");
                }}
                placeholder="Search by name or employee code"
                role="combobox"
                value={employeeSearch}
              />
            </span>
            {employeeSearch.trim() && !selectedEmployee ? (
              <div
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-1.5 shadow-xl"
                id="shift-employee-suggestions"
                role="listbox"
              >
                {matchingEmployees.length ? matchingEmployees.slice(0, 10).map((employee) => (
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-muted"
                    key={employee.id}
                    onClick={() => {
                      setEmployeeId(employee.id);
                      setEmployeeSearch(`${employee.employeeCode} · ${employee.name}`);
                    }}
                    aria-selected={false}
                    role="option"
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{employee.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{employee.employeeCode} · {employee.department ?? "Unassigned"}</span>
                    </span>
                    {employee.shift ? <span className="shrink-0 text-xs text-muted-foreground">{employee.shift.name}</span> : null}
                  </button>
                )) : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No active employee found.</p>}
              </div>
            ) : null}
          </div>
          <label className="block text-xs text-muted-foreground">Shift<span className="mt-1 block"><Select ariaLabel="Choose shift" onChange={setShiftId} options={(shifts.data ?? []).filter((shift) => shift.isActive).map((shift) => ({ value: shift.id, label: `${shift.name} (${toTime(shift.startMinutes)}–${toTime(shift.endMinutes)})` }))} placeholder="Choose shift" value={shiftId} /></span></label>
          <label className="block text-xs text-muted-foreground">Effective from<input className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm text-foreground" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></label>
          <Button className="w-full" variant="primary" disabled={!employeeId || !shiftId || !effectiveFrom || assignShift.isPending} onClick={() => assignShift.mutate({ employeeId, shiftId, effectiveFrom })} type="button">Assign shift</Button>
        </PanelBody>
      </Panel>
    </div>
  </AppShell>;
}
