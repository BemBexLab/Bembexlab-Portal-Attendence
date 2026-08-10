import { AttendanceStatusBadge } from "@/components/attendance/status-badge";
import type { AttendanceStatus } from "@/types/attendance";

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <AttendanceStatusBadge status={status} />;
}
