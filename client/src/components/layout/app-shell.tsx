"use client";

import {
  BarChart3,
  CalendarDays,
  Fingerprint,
  LayoutDashboard,
  Menu,
  MonitorCheck,
  CalendarRange,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeStore } from "@/stores/realtime-store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: UsersRound },
  { href: "/attendance", label: "Attendance", icon: CalendarDays },
  { href: "/leave-remote", label: "Leave & Remote", icon: CalendarRange },
  { href: "/devices", label: "Devices", icon: Fingerprint },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

type AppShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

export function AppShell({ children, title, description }: AppShellProps) {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const user = useAuthStore((state) => state.user);
  const realtimeConnected = useRealtimeStore((state) => state.connected);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 text-foreground">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-sidebar md:block",
            !sidebarOpen && "md:w-16",
          )}
        >
          <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
            <div className="grid size-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <MonitorCheck className="size-4" />
            </div>
            {sidebarOpen ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Bembex Portal</p>
                <p className="truncate text-xs text-muted-foreground">
                  Attendance Ops
                </p>
              </div>
            ) : null}
          </div>

          <nav className="space-y-1 px-2 py-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground",
                    !sidebarOpen && "justify-center px-0",
                  )}
                  href={item.href}
                  key={item.href}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0" />
                  {sidebarOpen ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={cn("md:pl-64", !sidebarOpen && "md:pl-16")}>
          <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Button
                  aria-label="Toggle navigation"
                  className="size-9 p-0"
                  onClick={toggleSidebar}
                  title="Toggle navigation"
                  type="button"
                  variant="ghost"
                >
                  <Menu className="size-4" />
                </Button>
                <div>
                  <h1 className="text-base font-semibold leading-5">{title}</h1>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "hidden h-7 items-center rounded-md border px-2 text-xs font-medium sm:inline-flex",
                    realtimeConnected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {realtimeConnected ? "Live" : "Syncing"}
                </span>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-medium">
                    {user?.name ?? "Operator"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.role?.replace("_", " ") ?? "Session"}
                  </p>
                </div>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground",
                      active && "bg-muted text-foreground",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="px-4 py-5 sm:px-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
