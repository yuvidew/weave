import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getLogs } from "../api"

// Fetches one page of agent runs. `placeholderData: keepPreviousData` keeps
// the previous page's rows on screen while the next page loads, instead of
// flashing a loading state on every Prev/Next click. `refetchInterval` is
// opt-in (e.g. the dashboard polls for live counts) so the paginated Runs
// table doesn't refetch out from under the user by default.
export const useGetLogs = (page: number, pageSize: number, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => getLogs({ page, pageSize }),
    queryKey: ["get-logs", page, pageSize],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  })
}
