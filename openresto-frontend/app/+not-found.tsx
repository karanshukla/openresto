import { Link, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function NotFoundScreen() {
  const pathname = usePathname();
  const { colors, primaryColor } = useAppTheme();

  return (
    <ThemedView style={styles.root}>
      <View style={styles.content}>
        <ThemedText style={styles.code}>404</ThemedText>
        <ThemedText style={styles.title}>Page not found</ThemedText>
        <ThemedText style={[styles.path, { color: colors.muted }]}>{pathname}</ThemedText>
        <Link href="/" style={[styles.link, { color: primaryColor }]}>
          Go to home
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", gap: 12, padding: 32 },
  code: { fontSize: 72, fontWeight: "700", letterSpacing: -2, opacity: 0.15 },
  title: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  path: { fontSize: 13, fontFamily: "monospace" },
  link: { fontSize: 15, fontWeight: "500", marginTop: 8 },
});
