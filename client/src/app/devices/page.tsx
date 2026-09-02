"use client";

import { useState } from "react";
import { Fingerprint, Info, Pencil, Plus, RefreshCw, Trash2, Wifi } from "lucide-react";
import axios from "axios";
import Swal from "sweetalert2";

import { DeviceStatusBadge } from "@/components/attendance/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  useDevices,
  useCreateDevice,
  useDeleteDevice,
  useFetchDeviceInfo,
  useSyncDeviceAttendance,
  useTestDevice,
  useUpdateDevice,
} from "@/hooks/use-attendance-data";
import type { DeviceInfoResponse, DeviceSyncResult } from "@/types/attendance";

export default function DevicesPage() {
  const devices = useDevices();
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
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

  const handleTest = async (deviceId: string) => {
    setDeviceErrors((current) => ({ ...current, [deviceId]: "" }));
    try {
      const result = await testDevice.mutateAsync(deviceId);
      await Swal.fire({
        title: "Device reachable",
        text: `Connection succeeded in ${result.latencyMs} ms.`,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
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

  const openCreateDevice = async () => {
    const result = await Swal.fire<{ name: string; ip: string; port: number }>({
      title: "Add device",
      html: `
        <div style="display:grid;gap:14px;text-align:left">
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">Device name
            <input id="device-name" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" placeholder="K40 Main Gate" autocomplete="off">
          </label>
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">IP address
            <input id="device-ip" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" placeholder="192.168.10.197" inputmode="decimal" autocomplete="off">
          </label>
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">Port
            <input id="device-port" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" value="4370" type="number" min="1" max="65535" inputmode="numeric">
          </label>
        </div>`,
      width: 460,
      showCancelButton: true,
      confirmButtonText: "Add device",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
      focusConfirm: false,
      preConfirm: () => {
        const name = (document.querySelector("#device-name") as HTMLInputElement).value.trim();
        const ip = (document.querySelector("#device-ip") as HTMLInputElement).value.trim();
        const port = Number((document.querySelector("#device-port") as HTMLInputElement).value);
        if (name.length < 2) {
          Swal.showValidationMessage("Enter a device name.");
          return false;
        }
        if (!/^((25[0-5]|2[0-4]\d|1?\d?\d)(\.|$)){4}$/.test(ip)) {
          Swal.showValidationMessage("Enter a valid IPv4 address.");
          return false;
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          Swal.showValidationMessage("Port must be between 1 and 65535.");
          return false;
        }
        return { name, ip, port };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    try {
      await createDevice.mutateAsync(result.value);
      await Swal.fire({ title: "Device added", icon: "success", timer: 1400, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ title: "Could not add device", text: getErrorMessage(error), icon: "error" });
    }
  };

  const openEditDevice = async (device: NonNullable<typeof devices.data>[number]) => {
    const result = await Swal.fire<{ name: string; ip: string; port: number; status: typeof device.status }>({
      title: "Edit device",
      html: `
        <div style="display:grid;gap:14px;text-align:left">
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">Device name
            <input id="edit-device-name" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" autocomplete="off">
          </label>
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">IP address
            <input id="edit-device-ip" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" inputmode="decimal" autocomplete="off">
          </label>
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">Port
            <input id="edit-device-port" class="swal2-input" style="width:100%;box-sizing:border-box;margin:0" type="number" min="1" max="65535" inputmode="numeric">
          </label>
          <label style="display:grid;gap:6px;font-size:13px;font-weight:600;color:#374151">Status
            <select id="edit-device-status" class="swal2-select" style="width:100%;box-sizing:border-box;margin:0;padding:0 12px">
              <option value="ACTIVE">Active</option><option value="OFFLINE">Offline</option><option value="MAINTENANCE">Maintenance</option><option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>`,
      width: 460,
      showCancelButton: true,
      confirmButtonText: "Save changes",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#171717",
      reverseButtons: true,
      focusConfirm: false,
      didOpen: () => {
        (document.querySelector("#edit-device-name") as HTMLInputElement).value = device.name;
        (document.querySelector("#edit-device-ip") as HTMLInputElement).value = device.ip;
        (document.querySelector("#edit-device-port") as HTMLInputElement).value = String(device.port);
        (document.querySelector("#edit-device-status") as HTMLSelectElement).value = device.status;
      },
      preConfirm: () => {
        const name = (document.querySelector("#edit-device-name") as HTMLInputElement).value.trim();
        const ip = (document.querySelector("#edit-device-ip") as HTMLInputElement).value.trim();
        const port = Number((document.querySelector("#edit-device-port") as HTMLInputElement).value);
        const status = (document.querySelector("#edit-device-status") as HTMLSelectElement).value as typeof device.status;
        if (name.length < 2) { Swal.showValidationMessage("Enter a device name."); return false; }
        if (!/^((25[0-5]|2[0-4]\d|1?\d?\d)(\.|$)){4}$/.test(ip)) { Swal.showValidationMessage("Enter a valid IPv4 address."); return false; }
        if (!Number.isInteger(port) || port < 1 || port > 65535) { Swal.showValidationMessage("Port must be between 1 and 65535."); return false; }
        return { name, ip, port, status };
      },
    });
    if (!result.isConfirmed || !result.value) return;
    try {
      await updateDevice.mutateAsync({ id: device.id, ...result.value });
      await Swal.fire({ title: "Device updated", icon: "success", timer: 1400, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ title: "Could not update device", text: getErrorMessage(error), icon: "error" });
    }
  };

  const removeDevice = async (device: NonNullable<typeof devices.data>[number]) => {
    const confirmation = await Swal.fire({
      title: `Remove ${device.name}?`,
      text: "The device will be removed. Its historical attendance logs will remain preserved.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove device",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      const result = await deleteDevice.mutateAsync(device.id);
      await Swal.fire({
        title: "Device removed",
        text: result.preservedLogs
          ? `${result.preservedLogs} historical attendance log${result.preservedLogs === 1 ? "" : "s"} preserved.`
          : undefined,
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({ title: "Could not remove device", text: getErrorMessage(error), icon: "error" });
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
          <Button onClick={() => void openCreateDevice()} type="button" variant="primary">
            <Plus className="size-4" />
            Add device
          </Button>
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
                    disabled={testDevice.isPending}
                    onClick={() => handleTest(device.id)}
                    type="button"
                  >
                    <Wifi className="size-4" />
                    Test
                  </Button>
                  <Button
                    disabled={fetchDeviceInfo.isPending}
                    onClick={() => handleFetchInfo(device.id)}
                    type="button"
                  >
                    <Info className="size-4" />
                    Info
                  </Button>
                  <Button
                    aria-label={`Edit ${device.name}`}
                    disabled={updateDevice.isPending}
                    onClick={() => void openEditDevice(device)}
                    type="button"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    aria-label={`Remove ${device.name}`}
                    className="text-destructive hover:text-destructive"
                    disabled={deleteDevice.isPending}
                    onClick={() => void removeDevice(device)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
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
