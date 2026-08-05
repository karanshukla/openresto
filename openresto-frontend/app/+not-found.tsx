import "@/theme/unistyles";
import { Link, usePathname } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function NotFoundScreen() {
  const pathname = usePathname();

  return (
    <ThemedView style={styles.root}>
      <View style={styles.content}>
        <ThemedText style={styles.code}>404</ThemedText>
        <ThemedText style={styles.title}>Page not found</ThemedText>
        <ThemedText style={styles.path}>{pathname}</ThemedText>
        <Link href="/" style={styles.link}>
          Go to home
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.xxxl },
  code: { fontSize: 72, fontWeight: "700", letterSpacing: -2, opacity: 0.15 },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  path: { fontSize: 13, fontFamily: "monospace", color: theme.colors.muted },
  link: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: theme.spacing.sm,
    color: theme.colors.primary,
  },
}));
