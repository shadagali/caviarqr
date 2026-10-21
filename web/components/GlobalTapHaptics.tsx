"use client"

import { useEffect } from "react"

export default function GlobalTapHaptics() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only run on touch-capable devices.
      const touchDevice =
        window.matchMedia("(pointer: coarse)").matches ||
        navigator.maxTouchPoints > 0

      if (!touchDevice) return

      // Respect the user's accessibility preference.
      if (
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
      ) {
        return
      }

      // Unsupported browsers, including Safari on iPhone.
      if (typeof navigator.vibrate !== "function") {
        return
      }

      if (!(event.target instanceof Element)) {
        return
      }

      // Works across all CaviarQR pages without modifying
      // individual button handlers.
      const control = event.target.closest(
        [
          "button",
          'a[href]',
          '[role="button"]',
          'input[type="button"]',
          'input[type="submit"]',
          'input[type="reset"]',
          "summary",
        ].join(",")
      )

      if (!control) return

      // Don't vibrate disabled controls.
      if (
        control.matches(':disabled, [aria-disabled="true"]') ||
        control.closest("[inert]")
      ) {
        return
      }

      try {
        // Short, subtle tap feedback: 20 milliseconds.
        navigator.vibrate(20)
      } catch {
        // Haptics must never interrupt ordering or navigation.
      }
    }

    // Capture phase runs before normal button click handlers.
    document.addEventListener("click", handleClick, true)

    return () => {
      document.removeEventListener("click", handleClick, true)
    }
  }, [])

  return null
}
