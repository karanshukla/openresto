import { StyleSheet, Platform } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  page: {
    maxWidth: Platform.OS === "web" ? /* istanbul ignore next */ 860 : 560,
    gap: 4,
  },
  form: {
    gap: 16,
  },
  field: {
    marginBottom: 8,
  },
});
