import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { bookingDetailStyles as styles } from "./booking-detail.styles";
import { Icon } from "@/components/common/Icon";

interface ExtendBookingActionsProps {
  borderColor: string;
  mutedColor: string;
  extending: boolean;
  onExtend: (mins: number) => void;
}

export function ExtendBookingActions({
  borderColor,
  mutedColor,
  extending,
  onExtend,
}: ExtendBookingActionsProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.section, { borderColor }]}>
      <View style={styles.sectionHeader}>
        <Icon name="time-outline" size="md" color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>
          {t("admin.bookings.detail.extendSection")}
        </ThemedText>
      </View>
      <View style={styles.extendBtns}>
        {[30, 60, 90].map((mins) => (
          <Button
            key={mins}
            size="md"
            style={styles.extendBtn}
            onPress={() => onExtend(mins)}
            disabled={extending}
            accessibilityLabel={t("admin.bookings.detail.extendByMinutesLabel", { mins })}
          >
            {t("admin.bookings.detail.extendByMinutes", { mins })}
          </Button>
        ))}
      </View>
    </View>
  );
}
