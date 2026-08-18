"use client";

import { useIsFetching } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

export function GlobalDataLoader() {
  const activeFetches = useIsFetching();

  if (activeFetches === 0) return null;

  return (
    <div
      aria-label="Loading data"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[200] grid place-items-center bg-background/65 backdrop-blur-[2px]"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-5 py-4 shadow-xl">
        <LoaderCircle className="size-6 animate-spin text-foreground" />
        <div>
          <p className="text-sm font-semibold">Loading data</p>
          <p className="text-xs text-muted-foreground">
            Please wait while the latest information is fetched.
          </p>
        </div>
      </div>
    </div>
  );
}
