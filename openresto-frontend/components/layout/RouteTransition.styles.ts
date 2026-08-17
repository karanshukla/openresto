import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  /**
   * `#root` is a vertical scroll container by accident: global.css sets
   * `overflow-x: hidden` on it, and CSS resolves the other axis of a
   * non-`visible` overflow to `auto`. A transform still contributes to an
   * ancestor's scrollable overflow, so the rising view's RISE pushed `#root`
   * past its own height for the length of the animation, raising a 10px
   * scrollbar (`::-webkit-scrollbar` in global.css) and reflowing the navbar
   * and the page 10px left and back — a horizontal judder on every route
   * change. Clipping here keeps the rise from reaching `#root` at all.
   *
   * @see [route-transition.spec.ts](../../e2e/route-transition.spec.ts) — pins
   * that the navbar's right edge holds still across a route change.
   */
  clip: { flex: 1, overflow: "hidden" },
  root: { flex: 1 },
});
