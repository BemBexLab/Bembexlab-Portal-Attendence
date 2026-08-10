"use client";

import { create } from "zustand";

import type { RealtimeEvent } from "@/types/realtime";

type RealtimeStore = {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  events: RealtimeEvent[];
  setConnected: (connected: boolean) => void;
  pushEvent: (event: RealtimeEvent) => void;
  clearEvents: () => void;
};

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  connected: false,
  lastEvent: null,
  events: [],
  setConnected: (connected) => set({ connected }),
  pushEvent: (event) =>
    set((state) => ({
      lastEvent: event,
      events: [event, ...state.events].slice(0, 50),
    })),
  clearEvents: () => set({ lastEvent: null, events: [] }),
}));
