"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ModeToggle } from "@/components/mode-toggle"

/**
 * @component ThemeDialog
 * @description Modal for switching the app's light/dark appearance via the existing ModeToggle button.
 */
export const ThemeDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Theme</DialogTitle>
          <DialogDescription>
            Choose how Weave looks on this device.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <ModeToggle />
        </div>
      </DialogContent>
    </Dialog>
  )
}
