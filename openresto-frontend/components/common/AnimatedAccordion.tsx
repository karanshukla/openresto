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

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [expanded, anim]);

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
