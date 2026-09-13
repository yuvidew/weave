import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "@/components/ui/toast"
import { createPluginConnectUrl, disconnectPlugin, getPlugins } from "../api"

// Pulls the server's `{ error }` message out of a failed request, falling
// back to a generic message for network errors or anything unexpected.
const getErrorMessage = (error: unknown, fallback: string) =>
    isAxiosError<{ error?: string }>(error) && error.response?.data?.error
        ? error.response.data.error
        : fallback

// Loads the apps/tools catalog for the Plugins grid.
export const useGetPlugins = () => {
    return useQuery({
        queryFn: getPlugins,
        queryKey: ["get-plugins"],
    })
}

// Starts an app's Connect flow: mints a token server-side and opens the
// returned Connect Link URL in a new tab. No manual "refetch on return"
// plumbing needed — the query client's default `refetchOnWindowFocus`
// re-runs useGetPlugins as soon as the user comes back to this tab.
export const useConnectPlugin = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createPluginConnectUrl,
        mutationKey: ["connect-plugin"],
        onSuccess: (url) => {
            queryClient.invalidateQueries({ queryKey: ["get-plugins"] })
            window.open(url, "_blank", "noopener,noreferrer")
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't start the connect flow",
                description: getErrorMessage(error, "Something went wrong starting that app's connect flow. Please try again."),
                type: "error",
            })
        },
    })
}

// Disconnects one app, then refetches the catalog so its card flips back to
// "Not Connected".
export const useDisconnectPlugin = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: disconnectPlugin,
        mutationKey: ["disconnect-plugin"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["get-plugins"] })
        },
        onError: (error) => {
            toast.add({
                title: "Couldn't disconnect",
                description: getErrorMessage(error, "Something went wrong disconnecting that app. Please try again."),
                type: "error",
            })
        },
    })
}
