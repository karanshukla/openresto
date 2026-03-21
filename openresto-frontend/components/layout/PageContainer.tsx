import { View, StyleSheet, type ViewProps } from "react-native";

/**
 * Constrains content to a readable max-width and centers it on wide screens.
 * Use on every full-page screen so content doesn't stretch across 1920px monitors.
 */
export default function PageContainer({
  children,
  style,
  ...props
}: ViewProps) {
  return (
    <View style={styles.outer} {...props}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
});
