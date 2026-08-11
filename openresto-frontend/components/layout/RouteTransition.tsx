import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";
import { usePathname } from "expo-router";
import { styles } from "./RouteTransition.styles";

const DURATION_MS = 180;
/** How far the incoming view rises as it fades in. */
const RISE = 6;

/**
 * Fades and lifts route content whenever the path changes. On web the user layout
 * renders a bare `<Slot />`, so moving between the home page, the locations list and a
 * booking confirmation is a hard cut with no sense of one view replacing another.
 *
 * Keyed off the pathname rather than the rendered children: query-string changes
 * (`?time=19:30`) land on the same view and should not replay the transition.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [pathname, anim]);

  return (
    <Animated.View
      testID="route-transition"
      style={[
        styles.root,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
