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
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelBody({ children, className }: PanelProps) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
