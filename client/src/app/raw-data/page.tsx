"use client";

import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useRawPunches } from "@/hooks/use-reports";
import { getRawPunchesExport } from "@/services/report-service";
import { downloadRawPunchesXlsx } from "@/lib/attendance-xlsx";

function formatPunchDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatPunchClock(value: string) {
  return new Date(value).toLocaleTimeString([], {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function pakistanDateTimeToIso(
  date: string,
  time: string,
  endOfDay = false,
) {
  if (!date) return undefined;

  const clock = time || (endOfDay ? "23:59:59.999" : "00:00:00.000");
  const normalizedClock = clock.length === 5 ? `${clock}:00` : clock;
  return new Date(`${date}T${normalizedClock}+05:00`).toISOString();
}

export default function RawDataPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);
  const fromIso = pakistanDateTimeToIso(from, "");
  const toIso = pakistanDateTimeToIso(to, "", true);
  const validRange = !fromIso || !toIso || fromIso <= toIso;
  const canExport = validRange;
  const punches = useRawPunches(debouncedSearch, page, fromIso, toIso);
  const totalPages = Math.max(
    1,
    Math.ceil((punches.data?.total ?? 0) / (punches.data?.pageSize ?? 100)),
  );
  const exportRawPunches = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      const result = await getRawPunchesExport(debouncedSearch, fromIso, toIso);
      await downloadRawPunchesXlsx(
        from || to
          ? `raw-punches-${from || "all"}-to-${to || "all"}.xlsx`
          : "raw-punches-all.xlsx",
        result.data,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      description="Every biometric punch received from connected devices."
      title="Raw Data"
    >
      <Panel>
        <PanelHeader className="min-w-0 flex-col items-stretch gap-3 xl:flex-row xl:items-end">
          {/* <div>
            <h2 className="text-sm font-semibold">Raw punches</h2>
            <p className="text-xs text-muted-foreground">
              Newest punches first. Search an employee to view their history.
            </p>
          </div> */}
          <div className="min-w-0 grid w-full gap-x-2 gap-y-3 sm:grid-cols-2 2xl:grid-cols-[minmax(260px,1.25fr)_minmax(180px,0.75fr)_minmax(180px,0.75fr)_auto]">
            <label className="relative min-w-0 self-end sm:col-span-2 2xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search punches by employee name or code" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee name or code" value={search} />
            </label>
            <label className="min-w-0 text-xs text-muted-foreground">From date<input className="mt-1 block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground" onChange={(event) => { setFrom(event.target.value); setPage(1); }} type="date" value={from} /></label>
            <label className="min-w-0 text-xs text-muted-foreground">To date<input className="mt-1 block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground" onChange={(event) => { setTo(event.target.value); setPage(1); }} type="date" value={to} /></label>
            <div className="flex min-w-0 flex-wrap items-end justify-start gap-2 sm:col-span-2 2xl:col-span-1">
              <Button className="min-w-[122px] whitespace-nowrap" disabled={isExporting || !canExport} onClick={() => void exportRawPunches()} type="button"><Download className="size-4" />{isExporting ? "Exporting..." : "Export XLSX"}</Button>
              <Button className="whitespace-nowrap" disabled={!from && !to} onClick={() => { setFrom(""); setTo(""); setPage(1); }} type="button">Clear</Button>
            </div>
          </div>
        </PanelHeader>
        {!validRange ? <p className="border-b border-border px-4 py-2 text-sm text-destructive">From date must be before To date.</p> : null}
        <PanelBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Employee code</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Device</th>
                  {/* <th className="px-4 py-3 font-medium">Verification</th> */}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(punches.data?.data ?? []).map((punch) => (
                  <tr className="hover:bg-muted/40" key={punch.id}>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatPunchDate(punch.punchTime)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatPunchClock(punch.punchTime)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {punch.employeeCode}
                    </td>
                    <td className="px-4 py-3">{punch.employee}</td>
                    <td className="px-4 py-3"><Badge tone={punch.punchStatus === "CHECK_IN" ? "green" : punch.punchStatus === "CHECK_OUT" ? "blue" : "neutral"}>{punch.punchStatus === "CHECK_IN" ? "Check-in" : punch.punchStatus === "CHECK_OUT" ? "Check-out" : "Additional punch"}</Badge></td>
                    <td className="px-4 py-3">{punch.device}</td>
                    {/* <td className="px-4 py-3 text-muted-foreground">
                      {formatVerification(punch.verificationType)}
                    </td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!punches.isLoading && !punches.data?.data.length ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No punches found{debouncedSearch ? ` for “${debouncedSearch}”` : ""}.
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
