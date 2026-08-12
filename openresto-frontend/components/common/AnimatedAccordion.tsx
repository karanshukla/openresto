import { useState, useEffect, type ReactNode } from "react";
import { Animated } from "react-native";
import { prefersReducedMotion } from "@/utils/webAnimation";

export function AnimatedAccordion({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const [anim] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [mounted, setMounted] = useState(expanded);

  if (expanded && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : 180;
    if (expanded) {
      Animated.timing(anim, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start(() => setMounted(false));
    }
  }, [expanded, anim]);

  if (!mounted) return null;

  return (
    <Animated.View
      // overflow:hidden clips visually but keeps collapsing content in the a11y tree — hide it explicitly.
      aria-hidden={!expanded}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
      style={{
        overflow: "hidden",
        maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 3000] }),
        opacity: anim,
      }}
    >
      {children}
    </Animated.View>
  );
}
