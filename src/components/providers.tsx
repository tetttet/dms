"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster theme="dark" richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
