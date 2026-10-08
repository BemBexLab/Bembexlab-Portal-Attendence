"use client";

import {
  BarChart3,
  CalendarDays,
  Fingerprint,
  LayoutDashboard,
  Menu,
  Rows3,
  Clock4,
  CalendarRange,
  UsersRound,
  KeyRound,
  Inbox,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtimeStore } from "@/stores/realtime-store";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "People & attendance",
    items: [
      { href: "/employees", label: "Employees", icon: UsersRound },
      { href: "/attendance", label: "Attendance", icon: CalendarDays },
      { href: "/shifts", label: "Shifts", icon: Clock4 },
      { href: "/leave-remote", label: "Leave & remote", icon: CalendarRange },
    ],
  },
  {
    label: "Payroll",
    items: [
      { href: "/payroll", label: "Payroll", icon: WalletCards },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Employee requests",
    items: [
      { href: "/requests", label: "Requests", icon: Inbox },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/devices", label: "Devices", icon: Fingerprint },
      { href: "/raw-data", label: "Raw punches", icon: Rows3 },
      { href: "/email-password", label: "Credentials", icon: KeyRound },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

type AppShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

export function AppShell({ children, title, description }: AppShellProps) {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const realtimeConnected = useRealtimeStore((state) => state.connected);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 text-foreground">
        {mobileNavOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/35 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          />
        ) : null}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 hidden w-[min(18rem,88vw)] flex-col border-r border-border bg-sidebar shadow-xl md:z-30 md:flex md:w-64 md:shadow-none",
            mobileNavOpen && "flex",
            !sidebarOpen && "md:w-16",
          )}
        >
          <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
            <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-sidebar-border bg-white">
              <Image
                alt="Bembex Portal"
                className="size-7 object-contain"
                height={28}
                src="/WhatsApp Image 2026-08-12 at 11.20.01 AM.jpeg"
                width={28}
              />
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

          <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                {sidebarOpen ? (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                    {group.label}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

                    return (
                      <Link
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent",
                          active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border",
                          !sidebarOpen && "justify-center px-0",
                        )}
                        href={item.href}
                        key={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        title={item.label}
                      >
                        <Icon className="size-4 shrink-0" />
                        {sidebarOpen ? <span>{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

        </aside>

        <div className={cn("md:pl-64", !sidebarOpen && "md:pl-16")}>
          <header className="sticky top-0 z-50 border-b border-border bg-background">
            <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                  <Button
                  aria-label="Toggle navigation"
                  className="size-9 p-0"
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setMobileNavOpen((open) => !open);
                    } else {
                      toggleSidebar();
                    }
                  }}
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
            <div className="flex items-center gap-2 border-t border-border px-3 py-2 md:hidden">
              <button className="text-xs font-medium text-muted-foreground" onClick={() => setMobileNavOpen(true)} type="button">
                Open navigation
              </button>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="truncate text-xs font-medium">{navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Workspace"}</span>
            </div>
          </header>

          <main className="p-0">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
