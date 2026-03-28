import { StyleSheet } from "react-native";
import { BUTTON_SIZES, COLORS } from "@/theme/theme";

export const editableRowStyles = StyleSheet.create({
  editableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  editableValue: { fontSize: 15, fontWeight: "600", flex: 1 },
  editableInput: { flex: 1 },
  rowActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  smallBtn: { ...BUTTON_SIZES.secondary, borderRadius: 8 },
  smallBtnText: { fontSize: 14, fontWeight: "600" },
  deleteText: { fontSize: 14, fontWeight: "600", color: COLORS.error },
});
