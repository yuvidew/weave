"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateAgent } from "./create-agent"
import { MyAgents } from "./my-agents"

/**
 * @component AgentView
 * @description Tabbed "Create Agent" / "My Agents" view for the /agents page.
 */
export const AgentView = () => {
    // Controlled so "View All" inside CreateAgent can switch to the My Agents tab.
    const [tab, setTab] = useState("create-agent")

    return (
        <div className='w-full max-w-4xl px-6 pt-20 pb-16'>
            <Tabs value={tab} onValueChange={setTab} >
                <TabsList>
                    <TabsTrigger value="create-agent">Create Agent</TabsTrigger>
                    <TabsTrigger value="my-agents">My Agents</TabsTrigger>
                </TabsList>
                <TabsContent value="create-agent">
                    <CreateAgent onViewAll={() => setTab("my-agents")} />
                </TabsContent>
                <TabsContent value="my-agents">
                    <MyAgents onCreateAgent={() => setTab("create-agent")} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
