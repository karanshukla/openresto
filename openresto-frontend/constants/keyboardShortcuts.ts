export type ShortcutScope = "admin" | "user";

export interface ShortcutEntry {
  keys: string;
  description: string;
}

// Admin scope. "/" navigates to the bookings list and focuses its lookup input:
// that bar is the one booking search left, so the shortcut goes to it from
// anywhere in the admin rather than to a sidebar copy of the same control.
export const ADMIN_SHORTCUTS: ShortcutEntry[] = [
  { keys: "g d", description: "Go to Dashboard" },
  { keys: "g b", description: "Go to Bookings" },
  { keys: "g l", description: "Go to Locations" },
  { keys: "g s", description: "Go to Brand settings" },
  { keys: "/", description: "Search bookings by name, email or reference" },
  { keys: "c", description: "Create a new booking" },
  { keys: "j / ↓", description: "Move selection down in the bookings list" },
  { keys: "k / ↑", description: "Move selection up in the bookings list" },
  { keys: "Enter", description: "Open the selected booking" },
  { keys: "e", description: "Open the selected booking's extend controls" },
  { keys: "Esc", description: "Close any open dialog" },
  { keys: "?", description: "Toggle this help overlay" },
];

// End-user scope. Per the issue #140 maintainer decision: no home-page search
// input exists and none is built as part of this feature, so "/" is
// intentionally absent here — do not add it.
export const USER_SHORTCUTS: ShortcutEntry[] = [
  { keys: "l", description: "Jump to the Find My Booking lookup" },
  { keys: "Esc", description: "Close any open dialog" },
  { keys: "?", description: "Toggle this help overlay" },
];

export const SHORTCUTS_BY_SCOPE: Record<ShortcutScope, ShortcutEntry[]> = {
  admin: ADMIN_SHORTCUTS,
  user: USER_SHORTCUTS,
};
