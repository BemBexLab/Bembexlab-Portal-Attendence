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
            staleTime: 120_000,
            gcTime: 10 * 60_000,
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
