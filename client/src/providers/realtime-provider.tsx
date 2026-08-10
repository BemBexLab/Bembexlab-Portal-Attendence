"use client";

import type { ReactNode } from "react";

import { useAttendanceRealtime } from "@/hooks/use-attendance-realtime";

type RealtimeProviderProps = {
  children: ReactNode;
};

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  useAttendanceRealtime();

  return <>{children}</>;
}
