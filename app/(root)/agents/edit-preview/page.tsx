// TEMPORARY verification-only route for checking the centralized error toast
// in useEditAgent fires on a real failed save. Delete before committing.
"use client"

import { NewAgentCard } from "@/features/agents/_components/agent-card"
import type { CreatAgentType } from "@/features/agents/types"

const mockAgent: CreatAgentType = {
    id: 13,
    userEmail: "yd00102@gmail.com",
    agentId: "mock-agent-id",
    name: "Inbox Summary Assistant",
    agentImage: "https://api.dicebear.com/10.x/voxel-bot/svg?tags=animation&seed=preview",
    description: "Summarize important Gmail inbox emails.",
    instructions: "1. Retrieve all emails from Gmail received within the past 24 hours.",
    objective: "Keep the user's inbox summarized daily.",
    tools: ["gmail"],
    skills: ["Email Summarization"],
    schedule: { type: "manual", time: "", frequency: "daily" },
    outputFormat: "Markdown structured summary.",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
}

const EditPreviewPage = () => {
    return (
        <div className="max-w-xl p-8">
            <NewAgentCard agent={mockAgent} />
        </div>
    )
}

export default EditPreviewPage
