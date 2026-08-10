"use client";

import { create } from "zustand";

type DashboardStore = {
  attendanceSearch: string;
  departmentFilter: string;
  setAttendanceSearch: (search: string) => void;
  setDepartmentFilter: (department: string) => void;
};

export const useDashboardStore = create<DashboardStore>((set) => ({
  attendanceSearch: "",
  departmentFilter: "All departments",
  setAttendanceSearch: (attendanceSearch) => set({ attendanceSearch }),
  setDepartmentFilter: (departmentFilter) => set({ departmentFilter }),
}));
