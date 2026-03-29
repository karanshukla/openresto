/**
 * Initialize theme synchronously on page load to prevent white flash
 * This runs before React renders, ensuring the correct theme is applied immediately
 */

const STORAGE_KEY = "openresto-theme";

export function initializeThemeSync(): void {
  // Only run on web
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Get stored preference
  let preference: "light" | "dark" | "system" = "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      preference = stored;
    }
  } catch {
    // localStorage not available, use system
  }

  // Determine color scheme
  let colorScheme: "light" | "dark";

  if (preference === "system") {
    // Check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      colorScheme = "light";
    } else {
      colorScheme = "dark";
    }
  } else {
    colorScheme = preference;
  }

  // Apply theme class immediately
  document.documentElement.classList.add("preload-theme");
  document.body.classList.add(colorScheme);
  document.body.classList.add("__app_initialized__");
}
