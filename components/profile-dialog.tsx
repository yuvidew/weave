"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { format } from "date-fns"

/**
 * @component ProfileDialog
 * @description Modal showing the signed-in user's avatar, name, email, and account join date.
 * @param name Display name.
 * @param email Account email.
 * @param imageUrl Clerk profile image URL, if any.
 * @param createdAt Account creation timestamp (DB `createdAt`), used as the "joined" date.
 */
export const ProfileDialog = ({
  open,
  onOpenChange,
  name,
  email,
  imageUrl,
  createdAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  email: string
  imageUrl?: string | null
  createdAt: Date | string
}) => {
  const initials = getInitials(name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Your account details.</DialogDescription>
        </DialogHeader>

        {/* Section 1: avatar + name/email */}
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar size="lg" className="size-16">
            <AvatarImage src={imageUrl ?? undefined} alt={name} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-base font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        {/* Section 2: join date */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Joined</span>
          <span className="font-medium">
            {format(new Date(createdAt), "MMMM d, yyyy")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
