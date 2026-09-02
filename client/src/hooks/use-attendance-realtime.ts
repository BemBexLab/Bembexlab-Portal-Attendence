"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { useRealtimeStore } from "@/stores/realtime-store";
import type {
  AttendanceUpdatedPayload,
  DeviceConnectionPayload,
} from "@/types/realtime";

const REALTIME_NAMESPACE = "realtime";

function getRealtimeUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return `${apiUrl.replace(/\/$/, "")}/${REALTIME_NAMESPACE}`;
}

export function useAttendanceRealtime() {
  const queryClient = useQueryClient();
  const pushEvent = useRealtimeStore((state) => state.pushEvent);
  const setConnected = useRealtimeStore((state) => state.setConnected);

  useEffect(() => {
    const socket = io(getRealtimeUrl(), {
      withCredentials: true,
      // Start with polling so development proxies and restrictive networks do
      // not log a failed websocket upgrade before Socket.IO can connect.
      // Socket.IO will still upgrade to websocket when the connection allows it.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAttendanceRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["attendance"] });
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        void queryClient.invalidateQueries({ queryKey: ["reports", "daily"] });
        void queryClient.invalidateQueries({
          queryKey: ["reports", "monthly"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["reports", "analytics"],
        });
      }, 750);
    };

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    socket.on("attendance.updated", (payload: AttendanceUpdatedPayload) => {
      pushEvent({
        type: "attendance.updated",
        payload,
        receivedAt: new Date().toISOString(),
      });
      scheduleAttendanceRefresh();
    });

    socket.on("device.connected", async (payload: DeviceConnectionPayload) => {
      pushEvent({
        type: "device.connected",
        payload,
        receivedAt: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    });

    socket.on(
      "device.disconnected",
      async (payload: DeviceConnectionPayload) => {
        pushEvent({
          type: "device.disconnected",
          payload,
          receivedAt: new Date().toISOString(),
        });
        await queryClient.invalidateQueries({ queryKey: ["devices"] });
      },
    );

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [pushEvent, queryClient, setConnected]);
}
