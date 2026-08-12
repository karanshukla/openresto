import { useLayoutEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { usePathname } from "expo-router";
import { animateNode, EASE_ENTER } from "@/utils/webAnimation";
import { styles } from "./RouteTransition.styles";

const DURATION_MS = 140;
/** How far the incoming view rises as it settles. */
const RISE = 6;
/**
 * The fade never reaches zero. Nothing is crossfading here — the outgoing view is gone
 * before the incoming one mounts — so a transparent frame shows the flat page background
 * across the whole viewport, which reads as the screen blinking rather than as one view
 * replacing another. Starting close to opaque keeps the movement without the blink.
 */
const START_OPACITY = 0.88;

/**
 * Keyed off the pathname rather than the rendered children: query-string changes
 * (`?time=19:30`) land on the same view and should not replay the transition. The first
 * paint is exempt too — a cold load has no previous view to replace, and animating it
 * only delays the content the visitor came for.
 *
 * The animation is started from a layout effect, before the browser paints: started after
 * it, the new view paints at rest for a frame and only then drops to START_OPACITY, so the
 * transition reads as a pulse.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<View>(null);
  const isFirstPaint = useRef(true);

  useLayoutEffect(() => {
    if (isFirstPaint.current) {
      isFirstPaint.current = false;
      return;
    }
    const anim = animateNode(
      ref.current,
      [
        { opacity: START_OPACITY, transform: `translateY(${RISE}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: DURATION_MS, easing: EASE_ENTER }
    );
    return () => anim?.cancel();
  }, [pathname]);

  return (
    <View ref={ref} testID="route-transition" style={styles.root}>
      {children}
    </View>
  );
}
