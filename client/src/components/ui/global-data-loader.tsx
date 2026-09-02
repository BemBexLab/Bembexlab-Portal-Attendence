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
      className="pointer-events-none fixed inset-0 z-[200] grid place-items-center bg-background/35 backdrop-blur-[1px]"
      role="status"
    >
      <div className="grid size-14 place-items-center rounded-full border border-border bg-background shadow-lg">
        <LoaderCircle className="size-7 animate-spin text-foreground" />
      </div>
    </div>
  );
}
