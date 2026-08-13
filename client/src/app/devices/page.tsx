"use client";

import { useState } from "react";
import { Fingerprint, RefreshCw, Wifi } from "lucide-react";
import axios from "axios";

import { DeviceStatusBadge } from "@/components/attendance/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useDevices,
  useFetchDeviceInfo,
  useSyncDeviceAttendance,
  useTestDevice,
} from "@/hooks/use-attendance-data";
import type { DeviceInfoResponse, DeviceSyncResult } from "@/types/attendance";

export default function DevicesPage() {
  const devices = useDevices();
  const testDevice = useTestDevice();
  const fetchDeviceInfo = useFetchDeviceInfo();
  const syncDeviceAttendance = useSyncDeviceAttendance();
  const [deviceInfo, setDeviceInfo] = useState<
    Record<string, DeviceInfoResponse>
  >({});
  const [syncResults, setSyncResults] = useState<
    Record<string, DeviceSyncResult>
  >({});
  const [deviceErrors, setDeviceErrors] = useState<Record<string, string>>({});

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message ?? error.message;
    }

    return error instanceof Error ? error.message : "Request failed";
  };

  const handleFetchInfo = async (deviceId: string) => {
    setDeviceErrors((current) => ({ ...current, [deviceId]: "" }));
    try {
      const info = await fetchDeviceInfo.mutateAsync(deviceId);
      setDeviceInfo((current) => ({ ...current, [deviceId]: info }));
    } catch (error) {
      setDeviceErrors((current) => ({
        ...current,
        [deviceId]: getErrorMessage(error),
      }));
    }
  };

  const handleSync = async (deviceId: string) => {
    setDeviceErrors((current) => ({ ...current, [deviceId]: "" }));
    try {
      const result = await syncDeviceAttendance.mutateAsync(deviceId);
      setSyncResults((current) => ({ ...current, [deviceId]: result }));
    } catch (error) {
      setDeviceErrors((current) => ({
        ...current,
        [deviceId]: getErrorMessage(error),
      }));
    }
  };

  return (
    <AppShell
      description="ZKTeco K40 device inventory and sync health."
      title="Devices"
    >
      <Panel>
        <PanelHeader className="flex-col items-stretch sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Biometric devices</h2>
            <p className="text-xs text-muted-foreground">
              Monitor connectivity and raw log synchronization.
            </p>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(devices.data ?? []).map((device) => (
              <article
                className="rounded-lg border border-border bg-background p-4"
                key={device.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-10 place-items-center rounded-md bg-muted">
                    <Fingerprint className="size-5 text-muted-foreground" />
                  </div>
                  <DeviceStatusBadge status={device.status} />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{device.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {device.ip}:{device.port}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Last sync:{" "}
                  {device.lastSync
                    ? new Date(device.lastSync).toLocaleString()
                    : "Never"}
                </p>
                {syncResults[device.id] ? (
                  <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p>
                      Sync: {syncResults[device.id].stored} stored,{" "}
                      {syncResults[device.id].duplicates} duplicates,{" "}
                      {syncResults[device.id].unmatched} unmatched,{" "}
                      {syncResults[device.id].skipped} skipped
                    </p>
                    {syncResults[device.id].error ? (
                      <p className="mt-1 text-red-700">
                        {syncResults[device.id].error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {deviceErrors[device.id] ? (
                  <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {deviceErrors[device.id]}
                  </p>
                ) : null}
                {deviceInfo[device.id] ? (
                  <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Device info</p>
                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(deviceInfo[device.id].info, null, 2)}
                    </pre>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={syncDeviceAttendance.isPending}
                    onClick={() => handleSync(device.id)}
                    type="button"
                    variant="primary"
                  >
                    <RefreshCw className="size-4" />
                    Sync
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
