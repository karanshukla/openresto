import { View } from "react-native";
import Skeleton from "@/components/common/Skeleton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./RestaurantCardSkeleton.styles";

/**
 * Placeholder card matching RestaurantCard's layout so the grid doesn't jump.
 */
export default function RestaurantCardSkeleton() {
  const { colors } = useAppTheme();

  return (
    <View
      testID="restaurant-card-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Skeleton width="100%" borderRadius={0} style={styles.image} />

      <View style={styles.body}>
        <Skeleton height={18} width="62%" />
        <Skeleton height={13} width="45%" />

        <View style={styles.slotRow}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={34} width={62} borderRadius={8} />
          ))}
        </View>
      </View>

      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <Skeleton height={12} width="40%" />
        <Skeleton height={12} width={70} />
      </View>
    </View>
  );
}
