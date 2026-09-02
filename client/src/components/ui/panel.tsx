import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-card text-card-foreground", className)}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ children, className }: PanelProps) {
  return (
    <div
      data-panel-header
      className={cn(
        "sticky top-[var(--app-header-height)] z-40 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelBody({ children, className }: PanelProps) {
  return (
    <div data-panel-body className={cn("p-4", className)}>
      {children}
    </div>
  );
}
