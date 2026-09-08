"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { RealtimeProvider } from "./realtime-provider";
import { GlobalDataLoader } from "@/components/ui/global-data-loader";

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            // Preserve the current screen while a changed filter, date, or
            // background refresh fetches its next result.
            placeholderData: (previousData: unknown) => previousData,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
        <GlobalDataLoader />
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
