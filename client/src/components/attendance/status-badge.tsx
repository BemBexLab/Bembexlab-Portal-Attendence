import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus, DeviceStatus } from "@/types/attendance";

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  if (status === "PRESENT") {
    return <Badge tone="green">Present</Badge>;
  }

  if (status === "LATE") {
    return <Badge tone="amber">Late</Badge>;
  }

  if (status === "MISSING_CHECKOUT") {
    return <Badge tone="blue">Missing checkout</Badge>;
  }

  if (status === "HALF_DAY") {
    return <Badge tone="amber">Half day</Badge>;
  }

  if (status === "ON_LEAVE") {
    return <Badge tone="blue">On leave</Badge>;
  }

  if (status === "HOLIDAY") {
    return <Badge>Holiday</Badge>;
  }

  return <Badge tone="red">Absent</Badge>;
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  if (status === "ACTIVE") {
    return <Badge tone="green">Active</Badge>;
  }

  if (status === "OFFLINE") {
    return <Badge tone="red">Offline</Badge>;
  }

  if (status === "MAINTENANCE") {
    return <Badge tone="amber">Maintenance</Badge>;
  }

  return <Badge>Inactive</Badge>;
}
