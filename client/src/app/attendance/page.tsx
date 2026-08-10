"use client";

import { AttendanceTable } from "@/components/attendance/attendance-table";
import { AppShell } from "@/components/layout/app-shell";

export default function AttendancePage() {
  return (
    <AppShell
      description="Daily first arrival, final exit, hours, and status."
      title="Attendance"
    >
      <AttendanceTable />
    </AppShell>
  );
}
