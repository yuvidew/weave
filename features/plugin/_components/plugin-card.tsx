"use client"

import { useState } from "react"
import { LinkIcon, Loader2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isDirectAuthTool } from "@/constant/direct-auth-tools"
import { cn } from "@/lib/utils"
import type { useConnectPlugin, useDisconnectPlugin } from "../hook/use-plugin"
import type { PluginTool } from "../types"

interface PluginCardProps {
  plugin: PluginTool
  // Shared across every card in the grid so only the one actually in flight
  // shows a spinner (see connectPlugin.variables?.slug below).
  connectPlugin: ReturnType<typeof useConnectPlugin>
  disconnectPlugin: ReturnType<typeof useDisconnectPlugin>
}

/**
 * @component PluginCard
 * @description One card in the Plugins grid — logo, connected/not-connected pill, name, description, and a Connect/Disconnect action. Direct-auth tools (shared server credential, no OAuth flow) render as always "Available" instead.
 * @param plugin The catalog entry to display.
 * @param connectPlugin Starts the Connect flow for this app.
 * @param disconnectPlugin Removes the user's connected account for this app.
 */
export const PluginCard = ({ plugin, connectPlugin, disconnectPlugin }: PluginCardProps) => {
  // Falls back to a generic link icon if the brand logo CDN fails to load.
  const [logoFailed, setLogoFailed] = useState(false)

  const isDirect = isDirectAuthTool(plugin.slug)
  const isConnecting = connectPlugin.isPending && connectPlugin.variables?.slug === plugin.slug
  const isDisconnecting = disconnectPlugin.isPending && disconnectPlugin.variables?.slug === plugin.slug

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
      <div className="flex items-start justify-between">
        {logoFailed || !plugin.logo ? (
          // No logo (some catalog rows have none) or the brand logo CDN
          // failed to load — an <img> with an empty src re-requests the
          // whole page, so skip rendering it entirely rather than pass "".
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <LinkIcon className="size-5" />
          </div>
        ) : (
          <img
            src={plugin.logo}
            alt=""
            className="size-10 rounded-md"
            onError={() => setLogoFailed(true)}
          />
        )}

        <Badge
          variant={plugin.connected ? "outline" : "secondary"}
          className={cn(
            "shrink-0",
            plugin.connected &&
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400"
          )}
        >
          {isDirect ? "Available" : plugin.connected ? "Connected" : "Not Connected"}
        </Badge>
      </div>

      <div>
        <span className="line-clamp-1 font-medium">{plugin.name}</span>
        <p className="mt-1 line-clamp-2 text-muted-foreground">
          {plugin.description || "No description available."}
        </p>
      </div>

      {isDirect ? (
        // Shared server-side credential, not a per-user OAuth connection —
        // nothing to connect/disconnect here.
        <Button variant="outline" className="w-full rounded-full" disabled>
          Available automatically
        </Button>
      ) : (
        <Button
          variant={plugin.connected ? "outline" : "default"}
          className="w-full rounded-full"
          disabled={isConnecting || isDisconnecting}
          onClick={() =>
            plugin.connected
              ? disconnectPlugin.mutate({ slug: plugin.slug })
              : connectPlugin.mutate({ slug: plugin.slug })
          }
        >
          {(isConnecting || isDisconnecting) && <Loader2Icon className="animate-spin" />}
          {plugin.connected ? "Disconnect" : "Connect"}
        </Button>
      )}
    </div>
  )
}
