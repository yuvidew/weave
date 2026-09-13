"use client"

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useDeleteAgent } from "../hook/use-agent"
import type { CreatAgentType } from "../types"

interface DeleteAgentDialogProps {
  agent: CreatAgentType
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * @component DeleteAgentDialog
 * @description Confirmation dialog for permanently deleting an agent — the destructive action stays disabled until the user types "delete {agent name}" exactly, guarding against an accidental click. Controlled from the parent card since its trigger is a DropdownMenuItem, not a real button an AlertDialogTrigger could merge onto.
 * @param agent The agent to delete.
 * @param open Whether the dialog is open.
 * @param onOpenChange Called when the dialog should open/close (backdrop click, Cancel, Escape, or right after a successful delete).
 */
export const DeleteAgentDialog = ({ agent, open, onOpenChange }: DeleteAgentDialogProps) => {
  const [confirmText, setConfirmText] = useState("")
  const { mutate: deleteAgent, isPending } = useDeleteAgent()

  // Clears any typed text whenever the dialog (re)opens, so a stale value
  // from a previous open — or a different agent — can't linger.
  useEffect(() => {
    if (open) setConfirmText("")
  }, [open])

  // Exact, case-sensitive match — same pattern GitHub uses for
  // "delete this repository" confirmations.
  const confirmPhrase = `DELETE`
  const isMatch = confirmText === confirmPhrase

  const handleDelete = () => {
    if (!isMatch || isPending) return
    deleteAgent(
      { agentId: agent.agentId, agentName: agent.name },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes this agent, its chat history, and any scheduled runs. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          {/* Stacked (not FieldLabel's default row) so the confirmation phrase
              gets its own line as a code block instead of wrapping mid-sentence
              — a long agent name used to push "to confirm" onto an odd line. */}
          <FieldLabel htmlFor="delete-agent-confirm" className="w-full">
            Type the phrase below to confirm:<span className=" uppercase text-destructive">{confirmPhrase}</span>
          </FieldLabel>
          <Input
            id="delete-agent-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
          />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={!isMatch || isPending} onClick={handleDelete}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {isPending ? "Deleting…" : "Delete agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
