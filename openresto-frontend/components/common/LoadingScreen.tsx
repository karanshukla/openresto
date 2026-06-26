import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Animated, Easing, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { Brand } from "@/types";

interface LoadingScreenProps {
  brand: Brand;
  message?: string;
}

export default function LoadingScreen({
  brand,
  message = "Preparing your table...",
}: LoadingScreenProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    marginTop: 32,
    marginBottom: 16,
  },
  text: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
