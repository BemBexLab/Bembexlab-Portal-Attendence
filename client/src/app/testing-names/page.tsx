"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useDirectDeviceAttendance } from "@/hooks/use-attendance-data";
import { downloadRawPunchesXlsx } from "@/lib/attendance-xlsx";
import type { RawPunch } from "@/types/attendance";

function pakistanDateTimeToIso(date: string, endOfDay = false) {
  if (!date) return undefined;
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:00`).toISOString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function TestingNamesPage() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const fromIso = pakistanDateTimeToIso(from);
  const toIso = pakistanDateTimeToIso(to, true);
  const validRange = !fromIso || !toIso || fromIso <= toIso;
  const history = useDirectDeviceAttendance(
    "",
    search.trim() || undefined,
    validRange ? fromIso : undefined,
    validRange ? toIso : undefined,
  );
  const rows = history.data?.data ?? [];
  const exportRows = useMemo<RawPunch[]>(
    () =>
      rows.map((punch, index) => ({
        id: `${punch.deviceId}-${punch.deviceUserId}-${punch.punchTime}-${index}`,
        employeeCode: punch.deviceUserId,
        employee: punch.employeeName ?? `Device user ${punch.deviceUserId}`,
        department: "Direct from ZKTeco",
        device: punch.deviceName,
        punchTime: punch.punchTime,
        punchStatus: "ADDITIONAL_PUNCH",
        verificationType: punch.verificationType,
      })),
    [rows],
  );

  const exportHistory = async () => {
    if (!exportRows.length) return;
    setIsExporting(true);
    try {
      await downloadRawPunchesXlsx(
        `zkteco-history-${from || "all"}-to-${to || "all"}.xlsx`,
        exportRows,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      title="Testing Names"
      description="Read historical punches directly from a connected ZKTeco device."
    >
      <Panel>
        <PanelHeader className="min-w-0 flex-col items-stretch gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Direct device history</h2>
            <p className="text-xs text-muted-foreground">
              These records are fetched live from the selected machine, not from the database.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[260px_160px_160px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" onChange={(event) => setSearch(event.target.value)} placeholder="Name or device user ID" value={search} />
            </label>
            <input aria-label="History from date" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
            <input aria-label="History to date" className="h-9 rounded-md border border-input bg-background px-3 text-sm" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
            <Button disabled={!exportRows.length || isExporting || !validRange} onClick={() => void exportHistory()} type="button" variant="secondary"><Download className="size-4" />{isExporting ? "Exporting..." : "Download XLSX"}</Button>
          </div>
        </PanelHeader>
        {!validRange ? <p className="border-b border-border px-4 py-2 text-sm text-destructive">From date must be before To date.</p> : null}
        <PanelBody className="p-0">
          {history.data ? <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Source: {history.data.source} · {history.data.devices.length} devices · {history.data.total.toLocaleString()} punches · Fetched {new Date(history.data.fetchedAt).toLocaleTimeString()}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">Device user ID</th><th className="px-4 py-3 font-medium">Name on device</th></tr></thead>
              <tbody className="divide-y divide-border">{rows.map((punch, index) => <tr className="hover:bg-muted/40" key={`${punch.deviceId}-${punch.deviceUserId}-${punch.punchTime}-${index}`}><td className="px-4 py-3 font-medium">{formatDate(punch.punchTime)}</td><td className="px-4 py-3 tabular-nums">{formatTime(punch.punchTime)}</td><td className="px-4 py-3">{punch.deviceName}</td><td className="px-4 py-3 font-medium">{punch.deviceUserId}</td><td className="px-4 py-3">{punch.employeeName ?? "Unnamed device user"}</td></tr>)}</tbody>
            </table>
          </div>
          {!history.isLoading && !rows.length ? <p className="px-4 py-12 text-center text-sm text-muted-foreground">No punches found on the connected devices for the selected filters.</p> : null}
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
