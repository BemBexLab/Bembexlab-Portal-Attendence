"use client";

import axios from "axios";
import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Inbox,
  Paperclip,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import {
  useEmployeeRequests,
  useUpdateEmployeeRequestStatus,
} from "@/hooks/use-attendance-data";
import type { EmployeeRequest } from "@/types/attendance";

type RequestFilter = "ALL" | EmployeeRequest["status"];

function errorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(" ") : message ?? error.message;
  }
  return error instanceof Error ? error.message : "Request failed";
}

function statusTone(status: EmployeeRequest["status"]) {
  if (status === "APPROVED") return "green" as const;
  if (status === "REJECTED") return "red" as const;
  if (status === "PENDING") return "amber" as const;
  return "neutral" as const;
}

function statusLabel(status: EmployeeRequest["status"]) {
  if (status === "APPROVED") return "Accepted";
  if (status === "REJECTED") return "Rejected";
  if (status === "CANCELLED") return "Cancelled";
  return "Pending";
}

function requestLabel(kind: EmployeeRequest["kind"]) {
  if (kind === "REMOTE_WORK") return "Remote work";
  if (kind === "CORRECTION") return "Attendance correction";
  return "Leave";
}

function complaintLabel(complaint: EmployeeRequest["complaintType"]) {
  if (!complaint) return null;
  return complaint
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

const statusOptions = [
  { value: "PENDING", label: "Pending", indicatorClassName: "bg-amber-500" },
  { value: "APPROVED", label: "Accepted", indicatorClassName: "bg-emerald-500" },
  { value: "REJECTED", label: "Rejected", indicatorClassName: "bg-red-500" },
];

function statusTriggerClass(status: EmployeeRequest["status"]) {
  if (status === "APPROVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70";
  }
  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700 hover:bg-red-100/70";
  }
  if (status === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100/70";
  }
  return "bg-muted text-muted-foreground";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(size: number | null | undefined) {
  if (!size || size < 1) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentHref(url: string) {
  return url.startsWith("/requests/") ? `/api${url}` : url;
}

export default function RequestsPage() {
  const [filter, setFilter] = useState<RequestFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<EmployeeRequest | null>(null);
  const requests = useEmployeeRequests(filter === "ALL" ? undefined : filter);
  const updateStatus = useUpdateEmployeeRequestStatus();

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (requests.data ?? [])
      .filter(
        (request) =>
          !term ||
          request.employee.toLowerCase().includes(term) ||
          request.employeeCode.toLowerCase().includes(term) ||
          request.reason.toLowerCase().includes(term),
      )
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }, [requests.data, search]);

  const changeStatus = async (
    request: EmployeeRequest,
    status: "PENDING" | "APPROVED" | "REJECTED",
  ) => {
    const nextStatus = statusLabel(status);
    const confirmation = await Swal.fire({
      title: `Change status to ${nextStatus}?`,
      text: `Update ${request.employee}'s ${requestLabel(request.kind).toLowerCase()} request from ${statusLabel(request.status).toLowerCase()} to ${nextStatus.toLowerCase()}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Update status",
      cancelButtonText: "Cancel",
      confirmButtonColor:
        status === "APPROVED"
          ? "#047857"
          : status === "REJECTED"
            ? "#dc2626"
            : "#171717",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    try {
      const updated = await updateStatus.mutateAsync({ id: request.id, status });
      setSelectedRequest((current) =>
        current?.id === request.id
          ? { ...current, status: updated.status, decidedAt: updated.decidedAt }
          : current,
      );
      await Swal.fire({
        title: `Request marked ${nextStatus.toLowerCase()}`,
        icon: status === "APPROVED" ? "success" : "info",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({
        title: "Could not update request",
        text: errorMessage(error),
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  return (
    <AppShell
      description="Review leave, remote-work, and attendance-correction requests."
      title="Requests"
    >
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700">
              <Inbox className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Employee requests</h2>
              <p className="text-xs text-muted-foreground">
                Review requests and update their status. Accepted and rejected
                requests are removed after two days.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <label className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search requests"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee or reason"
                value={search}
              />
            </label>
            <select
              aria-label="Filter requests by status"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              onChange={(event) => setFilter(event.target.value as RequestFilter)}
              value={filter}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </PanelHeader>
        <PanelBody className="p-0">
          {requests.isError ? (
            <div className="m-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>Could not load requests: {errorMessage(requests.error)}</span>
              <Button className="shrink-0" onClick={() => void requests.refetch()} type="button">
                Retry
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">S.No</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map((request, index) => (
                  <tr
                    className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRequest(request);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{request.employee}</p>
                      <p className="text-xs text-muted-foreground">{request.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{requestLabel(request.kind)}</p>
                      {request.complaintType ? (
                        <p className="text-xs text-muted-foreground">
                          {complaintLabel(request.complaintType)}
                        </p>
                      ) : null}
                      {request.leaveCategory ? <p className="text-xs text-muted-foreground">{request.leaveCategory.replaceAll("_", " ")}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {request.fromDate}{request.toDate !== request.fromDate ? ` → ${request.toDate}` : ""}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                      <p className="truncate" title={request.reason}>{request.reason}</p>
                      {request.expectedCheckIn || request.expectedCheckOut ? (
                        <p className="truncate text-xs">
                          Expected: {request.expectedCheckIn ? `in ${request.expectedCheckIn}` : ""}
                          {request.expectedCheckIn && request.expectedCheckOut ? " · " : ""}
                          {request.expectedCheckOut ? `out ${request.expectedCheckOut}` : ""}
                        </p>
                      ) : null}
                      {request.note ? <p className="truncate text-xs" title={request.note}>{request.note}</p> : null}
                    </td>
                    <td className="px-4 py-3"><Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge></td>
                    <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                      {request.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={`Accept ${request.employee}'s request`}
                            className="text-emerald-700 hover:text-emerald-800"
                            disabled={updateStatus.isPending}
                            onClick={() => void changeStatus(request, "APPROVED")}
                            type="button"
                          >
                            <Check className="size-4" />
                            Accept
                          </Button>
                          <Button
                            aria-label={`Reject ${request.employee}'s request`}
                            className="text-destructive hover:text-destructive"
                            disabled={updateStatus.isPending}
                            onClick={() => void changeStatus(request, "REJECTED")}
                            type="button"
                          >
                            <X className="size-4" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Select
                          ariaLabel={`Update ${request.employee}'s request status`}
                          className="ml-auto w-36"
                          disabled={updateStatus.isPending}
                          menuMinWidth={168}
                          onChange={(nextStatus) => {
                            if (nextStatus === request.status || nextStatus === "CANCELLED") return;
                            void changeStatus(
                              request,
                              nextStatus as "PENDING" | "APPROVED" | "REJECTED",
                            );
                          }}
                          options={
                            request.status === "CANCELLED"
                              ? [...statusOptions, { value: "CANCELLED", label: "Cancelled", indicatorClassName: "bg-slate-400" }]
                              : statusOptions
                          }
                          triggerClassName={statusTriggerClass(request.status)}
                          value={request.status}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!requests.isLoading && !filteredRequests.length ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {search ? "No requests match your search." : "No employee requests found."}
            </p>
          ) : null}
        </PanelBody>
      </Panel>

      {selectedRequest ? (
        <div
          aria-label="Request details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setSelectedRequest(null)}
          role="presentation"
        >
          <section
            aria-labelledby="request-details-title"
            aria-modal="true"
            className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {requestLabel(selectedRequest.kind)}
                  </span>
                  <Badge tone={statusTone(selectedRequest.status)}>{statusLabel(selectedRequest.status)}</Badge>
                </div>
                <h2 className="text-xl font-semibold" id="request-details-title">
                  Request details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submitted {formatDateTime(selectedRequest.submittedAt)}
                </p>
              </div>
              <button
                aria-label="Close request details"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-input text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setSelectedRequest(null)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
                    <p className="mt-1 font-medium">{selectedRequest.employee}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee code</p>
                  <p className="mt-1 font-medium tabular-nums">{selectedRequest.employeeCode}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dates</p>
                    <p className="mt-1 font-medium tabular-nums">
                      {selectedRequest.fromDate}
                      {selectedRequest.toDate !== selectedRequest.fromDate ? ` → ${selectedRequest.toDate}` : ""}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category / correction</p>
                  <p className="mt-1 font-medium">
                    {selectedRequest.leaveCategory
                      ? selectedRequest.leaveCategory.replaceAll("_", " ")
                      : complaintLabel(selectedRequest.complaintType) ?? "—"}
                  </p>
                </div>
              </div>

              {selectedRequest.expectedCheckIn || selectedRequest.expectedCheckOut ? (
                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <Clock3 className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected attendance</p>
                    <p className="mt-1 text-sm">
                      {selectedRequest.expectedCheckIn ? `Check-in ${selectedRequest.expectedCheckIn}` : ""}
                      {selectedRequest.expectedCheckIn && selectedRequest.expectedCheckOut ? " · " : ""}
                      {selectedRequest.expectedCheckOut ? `Check-out ${selectedRequest.expectedCheckOut}` : ""}
                    </p>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6">
                  {selectedRequest.reason || "No reason provided."}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Optional note</p>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm leading-6">
                  {selectedRequest.note || "No note provided."}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Paperclip className="size-4 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File attachments</p>
                </div>
                {selectedRequest.attachments?.length ? (
                  <div className="space-y-2">
                    {selectedRequest.attachments.map((attachment) => (
                      <a
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm transition hover:bg-muted/50"
                        href={attachmentHref(attachment.url)}
                        key={attachment.id ?? `${attachment.url}-${attachment.name}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{attachment.name}</span>
                        </span>
                        {formatFileSize(attachment.size) ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                    No attachments provided.
                  </p>
                )}
              </div>

              <div className="grid gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Last updated: {formatDateTime(selectedRequest.updatedAt)}</p>
                <p className="sm:text-right">
                  Decision: {selectedRequest.decidedAt ? formatDateTime(selectedRequest.decidedAt) : "Pending review"}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

    </AppShell>
  );
}
