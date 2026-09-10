"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/**
 * @component ModeToggle
 * @description Icon button that flips the app between light and dark theme.
 */
export const ModeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme()
  // Whether the client has hydrated — gates rendering the theme-dependent icon.
  const [mounted, setMounted] = React.useState(false)

  // Avoid rendering theme-dependent UI until mounted, to prevent hydration mismatch.
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Flips between the two themes based on the currently resolved one.
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
