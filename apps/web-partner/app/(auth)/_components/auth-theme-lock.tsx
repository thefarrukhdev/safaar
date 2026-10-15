"use client";

import { useEffect } from "react";

/**
 * AuthThemeLock:
 * Enforces strict, pure light-mode on all authentication pages (/login, /register, /status).
 * Strips the 'dark' class from <html> and ensures light color scheme while mounted,
 * restoring the previous state upon unmount when navigating into the authenticated dashboard.
 */
export function AuthThemeLock() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    const prevColorScheme = root.style.colorScheme;

    const enforceLight = () => {
      if (root.classList.contains("dark")) {
        root.classList.remove("dark");
      }
      if (!root.classList.contains("light")) {
        root.classList.add("light");
      }
      root.style.colorScheme = "light";
    };

    // Enforce immediately on mount
    enforceLight();

    // Guard against next-themes or system listener reapplying dark mode
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark")) {
        root.classList.remove("dark");
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      root.classList.remove("light");
      if (hadDark) {
        root.classList.add("dark");
      }
      root.style.colorScheme = prevColorScheme;
    };
  }, []);

  return null;
}
