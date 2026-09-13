import { format } from "date-fns"
import { ClockIcon } from "lucide-react"
import { useUserDetail } from "@/context/user-detail-context"

// "Good morning/afternoon/evening" based on the current local hour — purely
// cosmetic, recomputed on every render since the page is short-lived.
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * @component DashboardHeader
 * @description Top-of-dashboard banner — today's date, a time-of-day greeting
 * with the signed-in user's name, and a short description. The data below it
 * (DashboardView) polls on its own, so there's no manual refresh action here.
 */
export const DashboardHeader = () => {
  const { userDetail } = useUserDetail()

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ClockIcon className="size-3.5" />
        {format(new Date(), "EEEE, MMMM d")}
      </div>
      <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
        {getGreeting()}
        {userDetail?.name ? `, ${userDetail.name}` : ""}
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Here&apos;s the latest pulse from your agents, runs, schedules, and anything that needs a closer look.
      </p>
    </div>
  )
}
