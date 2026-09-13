// One entry in the Plugins grid, as returned by GET /api/plugin — every
// active `tools` row, with `name`/`logo` resolved against Pipedream and
// `connected` resolved against the signed-in user's Pipedream accounts (see
// app/api/plugin/route.ts). Connections are per-user, not per-agent, so this
// is the same "connected" every one of the user's agents would see too.
export type PluginTool = {
  slug: string
  name: string
  description: string | null
  logo: string
  connected: boolean
}

// Shape of the raw GET /api/plugin response.
export type PluginsResponse = {
  tools: PluginTool[]
}
