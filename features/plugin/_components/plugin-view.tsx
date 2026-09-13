"use client"

import { isAxiosError } from "axios"
import { Loader2Icon, PlugIcon } from "lucide-react"
import { useConnectPlugin, useDisconnectPlugin, useGetPlugins } from "../hook/use-plugin"
import { PluginCard } from "./plugin-card"

/**
 * @component PluginView
 * @description Plugins page — a responsive grid of connectable apps/tools, each showing its logo, connection status, description, and a Connect/Disconnect action. Backed by GET /api/plugin, with loading/error/empty states. Connecting an app is per-user, so it's immediately available to every one of the user's agents.
 */
const PluginView = () => {
  const { data: plugins, isPending, isError, error } = useGetPlugins()
  // Shared across every card so only the row actually in flight shows a
  // spinner (see PluginCard's isConnecting/isDisconnecting checks).
  const connectPlugin = useConnectPlugin()
  const disconnectPlugin = useDisconnectPlugin()

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-bold text-2xl">Plugins</h2>
        <p>Connect the tools your agents need to get work done.</p>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading integrations…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {isAxiosError<{ error?: string }>(error) && error.response?.data?.error
            ? error.response.data.error
            : "Something went wrong loading the integrations catalog. Please try again."}
        </div>
      ) : !plugins || plugins.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <PlugIcon className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium">No integrations available</p>
            <p className="text-sm text-muted-foreground">Check back once tools are added to the catalog.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.slug}
              plugin={plugin}
              connectPlugin={connectPlugin}
              disconnectPlugin={disconnectPlugin}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default PluginView
