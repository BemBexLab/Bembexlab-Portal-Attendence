"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";

import { useAuthStore } from "@/stores/auth-store";
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
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const pushEvent = useRealtimeStore((state) => state.pushEvent);
  const setConnected = useRealtimeStore((state) => state.setConnected);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }

    const socket = io(getRealtimeUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    socket.on(
      "attendance.updated",
      async (payload: AttendanceUpdatedPayload) => {
        pushEvent({
          type: "attendance.updated",
          payload,
          receivedAt: new Date().toISOString(),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["attendance"] }),
          queryClient.invalidateQueries({ queryKey: ["daily-attendance"] }),
          queryClient.invalidateQueries({ queryKey: ["devices"] }),
          queryClient.invalidateQueries({ queryKey: ["reports"] }),
        ]);
      },
    );

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

    socket.on("unauthorized", () => {
      clearAuth();
    });

    return () => {
      socket.disconnect();
    };
  }, [clearAuth, pushEvent, queryClient, setConnected, user]);
}
