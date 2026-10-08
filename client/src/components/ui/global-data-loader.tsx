"use client";

import { useIsFetching } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

export function GlobalDataLoader() {
  const initialFetches = useIsFetching({
    predicate: (query) =>
      query.state.status === "pending" && query.state.data === undefined,
  });

  if (initialFetches === 0) return null;

  return (
    <div
      aria-label="Loading data"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[200] flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg sm:right-6 sm:top-5"
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin text-primary" />
      Loading data…
    </div>
  );
}
