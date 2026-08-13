"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useRawPunches } from "@/hooks/use-reports";

function formatPunchTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatVerification(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function pakistanDateToIso(value: string, endOfDay = false) {
  return value
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:00`).toISOString()
    : undefined;
}

export default function RawDataPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const fromIso = pakistanDateToIso(from);
  const toIso = pakistanDateToIso(to, true);
  const validRange = !fromIso || !toIso || fromIso <= toIso;
  const punches = useRawPunches(deferredSearch, page, fromIso, toIso);
  const totalPages = Math.max(
    1,
    Math.ceil((punches.data?.total ?? 0) / (punches.data?.pageSize ?? 100)),
  );

  return (
    <AppShell
      description="Every biometric punch received from connected devices."
      title="Raw Data"
    >
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-3 xl:flex-row xl:items-end">
          <div>
            <h2 className="text-sm font-semibold">Raw punches</h2>
            <p className="text-xs text-muted-foreground">
              Newest punches first. Search an employee to view their history.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
            <label className="relative self-end">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search punches by employee name or code" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee name or code" value={search} />
            </label>
            <label className="text-xs text-muted-foreground">From date<input className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /></label>
            <label className="text-xs text-muted-foreground">To date<input className="mt-1 block h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></label>
            <Button className="self-end" disabled={!from && !to} onClick={() => { setFrom(""); setTo(""); setPage(1); }} type="button">Clear</Button>
          </div>
        </PanelHeader>
        {!validRange ? <p className="border-b border-border px-4 py-2 text-sm text-destructive">From date must be before To date.</p> : null}
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Punch time</th>
                  <th className="px-4 py-3 font-medium">Employee code</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                  <th className="px-4 py-3 font-medium">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(punches.data?.data ?? []).map((punch) => (
                  <tr className="hover:bg-muted/40" key={punch.id}>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatPunchTime(punch.punchTime)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {punch.employeeCode}
                    </td>
                    <td className="px-4 py-3">{punch.employee}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {punch.department}
                    </td>
                    <td className="px-4 py-3">{punch.device}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatVerification(punch.verificationType)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!punches.isLoading && !punches.data?.data.length ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No punches found{deferredSearch ? ` for “${deferredSearch}”` : ""}.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {punches.isLoading
                ? "Loading punches..."
                : `${(punches.data?.total ?? 0).toLocaleString()} punches · Page ${page} of ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <Button
                aria-label="Previous page"
                className="size-9 p-0"
                disabled={page === 1 || punches.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                aria-label="Next page"
                className="size-9 p-0"
                disabled={page >= totalPages || punches.isFetching}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
