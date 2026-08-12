import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ScrollToTopFab.styles";
import { Icon } from "@/components/common/Icon";

/** Scroll distance past which the return-to-top shortcut is worth offering. */
export const SHOW_AFTER_SCROLL_Y = 300;

interface Props {
  visible: boolean;
  onPress: () => void;
}

export default function ScrollToTopFab({ visible, onPress }: Props) {
  const { primaryColor } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Deliberately not gated on width or orientation. Every screen that mounts this
  // is long enough to bury its own header on a desktop window too.
  if (!visible) return null;

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: primaryColor, bottom: insets.bottom + 20 }]}
      onPress={onPress}
      accessibilityLabel="Scroll to top"
      accessibilityRole="button"
    >
      <Icon name="chevron-up" size={22} color="#fff" />
    </Pressable>
  );
}
