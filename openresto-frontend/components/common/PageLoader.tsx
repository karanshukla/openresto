import { View, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./PageLoader.styles";

export default function PageLoader() {
  const { colors, primaryColor } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]} testID="loading-screen">
      <ActivityIndicator size="large" color={primaryColor} />
    </View>
  );
}
