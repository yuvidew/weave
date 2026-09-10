import * as React from "react"

// Viewport width (px) below which the UI switches to its mobile layout.
const MOBILE_BREAKPOINT = 768

// Tracks whether the viewport is currently narrower than `MOBILE_BREAKPOINT`.
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
