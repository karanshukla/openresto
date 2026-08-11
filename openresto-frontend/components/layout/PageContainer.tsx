import { View, type ViewProps, useWindowDimensions } from "react-native";
import { theme } from "@/theme/theme";
import { isMobileWidth } from "@/constants/breakpoints";
import { styles } from "./PageContainer.styles";

// Constrains content to a readable max-width and centres it on wide screens.
// Use on every full-page screen so content doesn't stretch across 1920px monitors.
export default function PageContainer({ children, style, ...props }: ViewProps) {
  const { width } = useWindowDimensions();
  const isMobile = isMobileWidth(width);

  return (
    <View style={styles.outer} {...props}>
      <View style={[styles.inner, isMobile && { paddingHorizontal: theme.spacing.lg }, style]}>
        {children}
      </View>
    </View>
  );
}
