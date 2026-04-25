import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Animated, Easing, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBrand, Brand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";

interface LoadingScreenProps {
  brand?: Brand;
  message?: string;
}

export default function LoadingScreen({ brand: propBrand, message = "Preparing your table..." }: LoadingScreenProps) {
  const contextBrand = useBrand();
  const brand = propBrand || contextBrand;
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    ]).start();
  }, [fadeAnim, scaleAnim, rotateAnim]);

  if (process.env.NODE_ENV === "test") {
    return (
      <View testID="loading-screen">
        <Text>{message}</Text>
        <Text>{brand.appName}</Text>
      </View>
    );
  }

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialCommunityIcons 
            name="silverware-fork-knife" 
            size={80} 
            color={brand.primaryColor} 
          />
        </Animated.View>
        <ActivityIndicator 
          size="large" 
          color={brand.primaryColor} 
          style={styles.spinner} 
        />
        <ThemedText style={styles.text}>{message}</ThemedText>
        <ThemedText style={[styles.subtext, { color: colors.muted }]}>
          {brand.appName}
        </ThemedText>
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
