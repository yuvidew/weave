import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Merges conditional class names and resolves conflicting Tailwind classes.
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}


export const getBrowserTimezone = () => {
  return (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
}

// Extracts up to two initials (first + last name) for the avatar fallback.
export const getInitials = (name?: string | null) => {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const initials = [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join("")
  return initials.toUpperCase() || "?"
}
