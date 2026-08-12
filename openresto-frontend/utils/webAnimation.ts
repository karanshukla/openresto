export const EASE_ENTER = "cubic-bezier(0.2, 0, 0, 1)";
export const EASE_EXIT = "cubic-bezier(0.4, 0, 1, 1)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function domNode(target: unknown): HTMLElement | null {
  const node = target as HTMLElement | null;
  return node && typeof node.animate === "function" ? node : null;
}

/**
 * Runs a keyframe animation on a View's underlying DOM node.
 *
 * Deliberately not `Animated`: these animations fire at the exact moment a new screen or a
 * booking form is mounting, and `Animated` without the native driver ticks from JS on that
 * same busy main thread — measured at 49ms between frames during a route change, so a
 * 140ms fade stuttered through three visible steps. The Web Animations API hands opacity
 * and transform to the compositor, which keeps running while JS is blocked.
 *
 * It also sidesteps `global.css`'s `* { transition: none !important }`, which kills every
 * CSS transition in the app, declared in a stylesheet or inline.
 *
 * Returns null when there is no DOM node (native, tests) or the visitor asked for reduced
 * motion. Callers must read that as "the animation is already over" and not wait on it.
 */
export function animateNode(
  target: unknown,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Animation | null {
  const node = domNode(target);
  if (!node || prefersReducedMotion()) return null;
  return node.animate(keyframes, options);
}
