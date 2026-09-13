import axios from "axios"
import type { LogsResponse } from "../types"

// Fetches one page of the signed-in user's agent runs, joined with their
// agent's name/image/objective server-side (see app/api/logs/route.ts).
export const getLogs = async ({ page, pageSize }: { page: number; pageSize: number }) => {
  const { data } = await axios.get<LogsResponse>("/api/logs", { params: { page, pageSize } })

  return data
}
