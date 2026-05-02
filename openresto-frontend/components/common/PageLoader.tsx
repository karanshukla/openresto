import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useBrand } from "@/context/BrandContext";
import { getThemeColors } from "@/theme/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function PageLoader() {
  const brand = useBrand();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]} testID="loading-screen">
      <ActivityIndicator size="large" color={brand.primaryColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
