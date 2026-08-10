import { Link, usePathname } from "expo-router";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./+not-found.styles";

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
