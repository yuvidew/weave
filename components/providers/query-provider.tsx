"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * @component QueryProvider
 * @description Wraps the app in a single, stable TanStack Query client so data hooks can fetch, cache, and dedupe requests.
 */
export const QueryProvider = ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) => {
  // Created once via useState's initializer, not on every render — otherwise
  // the cache would be thrown away and recreated on each re-render.
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
