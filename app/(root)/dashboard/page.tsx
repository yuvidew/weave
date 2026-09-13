import { DashboardView } from "@/features/dashboard/_components/dashboard-view"

/**
 * @component Dashboard Page
 * @description Dashboard home route — renders the greeting header, stat
 * tiles, recent-agent spotlight, and activity lists via DashboardView.
 */
const DashboardPage = () => {
  return (
    <div className="p-10 md:px-15 lg:px-28">
      <DashboardView />
    </div>
  )
}

export default DashboardPage;
