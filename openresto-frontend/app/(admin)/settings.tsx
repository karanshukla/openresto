import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { StyleSheet } from "react-native";

// Placeholder — restaurant settings (hours, contact info, etc.) to be implemented
// alongside the backend settings endpoints.
export default function AdminSettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText style={styles.note}>
        Restaurant settings will be available here once the backend settings
        endpoints are implemented.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  note: {
    opacity: 0.6,
    marginTop: 8,
  },
});
