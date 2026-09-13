import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getLogs } from "../api"

// Fetches one page of agent runs. `placeholderData: keepPreviousData` keeps
// the previous page's rows on screen while the next page loads, instead of
// flashing a loading state on every Prev/Next click.
export const useGetLogs = (page: number, pageSize: number) => {
  return useQuery({
    queryFn: () => getLogs({ page, pageSize }),
    queryKey: ["get-logs", page, pageSize],
    placeholderData: keepPreviousData,
  })
}
