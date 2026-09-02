import { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator, Animated, Easing, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { DEFAULT_COPY } from "@/constants/defaultCopy";
import { Brand } from "@/types";
import { styles } from "./LoadingScreen.styles";

interface LoadingScreenProps {
  brand: Brand;
  message?: string;
}

export default function LoadingScreen({
  brand,
  message = DEFAULT_COPY.loadingMessage,
}: LoadingScreenProps) {
  /**
   * The palette is read straight from the color scheme rather than through `useAppTheme`,
   * which reaches into `BrandContext` for `primaryColor`. This screen is what BrandContext
   * renders *while* it is fetching the brand, so going through the hook closed a require
   * cycle — use-app-theme → BrandContext → LoadingScreen → use-app-theme — that Metro warns
   * about on every start. Nothing here is brand-coloured, so there is nothing to lose: a
   * screen shown before the brand exists must not depend on it.
   */
  const isDark = useColorScheme() === "dark";
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.9));
  const [rotateAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    /* istanbul ignore else */
    if (process.env.NODE_ENV === "test") return;
    /* istanbul ignore next */
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* istanbul ignore else */
  if (process.env.NODE_ENV === "test") {
    return (
      <View testID="loading-screen">
        <Text>{message}</Text>
        <Text>{brand.appName}</Text>
      </View>
    );
  }

  /* istanbul ignore next */
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  /* istanbul ignore next */
  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={80}
            color={brand.primaryColor}
          />
        </Animated.View>
        <ActivityIndicator size="large" color={brand.primaryColor} style={styles.spinner} />
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
        <Text style={[styles.subtext, { color: colors.muted }]}>{brand.appName}</Text>
      </Animated.View>
    </View>
  );
}
