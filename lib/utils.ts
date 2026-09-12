import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Merges conditional class names and resolves conflicting Tailwind classes.
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}


export const getBrowserTimezone = () => {
  return (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
} 