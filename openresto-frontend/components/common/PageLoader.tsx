import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function PageLoader() {
  const { colors, primaryColor } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]} testID="loading-screen">
      <ActivityIndicator size="large" color={primaryColor} />
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
