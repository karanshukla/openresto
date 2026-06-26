import React from "react";
import { Animated, Easing, DimensionValue, ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  const [animatedValue] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    /* istanbul ignore else */
    if (process.env.NODE_ENV === "test") return;
    /* istanbul ignore next */
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}
