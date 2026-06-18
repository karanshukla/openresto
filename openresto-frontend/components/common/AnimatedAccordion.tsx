import { useState, useEffect, type ReactNode } from "react";
import { Animated } from "react-native";

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
    if (expanded) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start(() => setMounted(false));
    }
  }, [expanded, anim]);

  if (!mounted) return null;

  return (
    <Animated.View
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
