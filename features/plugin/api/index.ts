import axios from "axios"
import type { PluginsResponse } from "../types"

// Fetches the full apps/tools catalog for the Plugins grid.
export const getPlugins = async () => {
    const { data } = await axios.get<PluginsResponse>("/api/plugin")

    return data.tools
}

// Mints a Pipedream Connect token for one app and returns the hosted Connect
// Link URL to open — connections are per-user, so this makes the app
// available to every one of the user's agents, not just one.
export const createPluginConnectUrl = async ({ slug }: { slug: string }) => {
    const { data } = await axios.post<{ url: string }>("/api/plugin/connect", { slug })

    return data.url
}

// Removes the user's connected account for one app.
export const disconnectPlugin = async ({ slug }: { slug: string }) => {
    const { data } = await axios.delete<{ success: boolean }>("/api/plugin/connect", {
        data: { slug },
    })

    return data
}
