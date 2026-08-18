import type { Role } from "react-native";

/**
 * DOM props react-native-web forwards but React Native's own types do not declare.
 *
 * RNW passes every `aria-*` attribute and `onKeyDown` straight through to the element it
 * renders; `ViewProps` declares only a handful of the former and none of the latter, so a
 * combobox that wants `aria-activedescendant`, or a panel that wants to hear a keystroke, has
 * nowhere to put them. Spreading this record is the alternative to `as any`, which the lint
 * forbids and which would drop the typing on everything else at the same call site.
 *
 * On native these are inert extra props, which is correct: none of them has a meaning there,
 * and the keyboard paths they serve only exist on web.
 */
export interface WebKeyEvent {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export interface WebOnlyProps {
  onKeyDown?: (event: WebKeyEvent) => void;
  "aria-activedescendant"?: string;
  "aria-controls"?: string;
  "aria-haspopup"?: "listbox" | "menu" | "dialog";
}

/**
 * Index-signature-typed so it can be spread onto a `View` or `Pressable` without the excess
 * property check rejecting props RNW understands and RN has not typed.
 */
export const webProps = (props: WebOnlyProps): Record<string, unknown> =>
  props as Record<string, unknown>;

/**
 * `listbox` is a real ARIA role that RNW forwards verbatim, but React Native's `Role` union
 * omits it — the list runs `list | listitem | log`, with nothing in between. Named once here
 * rather than casting at each use.
 */
export const LISTBOX_ROLE = "listbox" as Role;

/**
 * Same gap for the calendar grid: React Native's `Role` union has `grid`, `row` and
 * `columnheader` but stops at `cell` where ARIA says `gridcell`, and a `cell` inside a `grid`
 * is not the role a day of the month is supposed to carry.
 */
export const GRIDCELL_ROLE = "gridcell" as Role;
