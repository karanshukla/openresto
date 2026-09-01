import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { VENDOR_BRANDS } from "@/constants/vendorBrands";
import { buildCalendarUrls } from "@/utils/calendar";
import { openExternal } from "@/utils/openExternal";
import { styles } from "./CalendarActions.styles";

interface CalendarActionsProps {
  bookingRef: string;
  date: string;
  endTime?: string;
  seats: number;
  specialRequests?: string;
  restaurantName: string;
  restaurantAddress: string;
  sectionName?: string;
  tableName?: string;
}

/**
 * Add-to-calendar pills, one row, at every width. These were three full-width rows carrying
 * their own tinted backgrounds — hand-rolled Pressables the size of a form's submit for what
 * is a side errand, and three of them stacked read as the most important thing on the card.
 * As `Button`s in a `ButtonRow` they take their natural width, wrap when the column is too
 * narrow, and inherit the same treatment as the directions pills directly below them.
 *
 * The two that hand the diner to a service wear that service's logo and brand blue; the .ics stays
 * neutral because a file format has no brand to wear. That is also why its label is just the
 * extension — spelled out as "Download .ics" it pushed the row onto a second line on a phone,
 * for a word the download glyph beside it already says.
 *
 * All three work on every platform: the two service links go through `openExternal` (a new
 * tab on web, the OS handler on native) and the .ics through `deliverIcs` (a download on web,
 * the share sheet on native).
 */
export default function CalendarActions(props: CalendarActionsProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { googleUrl, outlookUrl, downloadIcs } = buildCalendarUrls(props);

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>
        {t("booking.calendar.heading")}
      </ThemedText>
      <ButtonRow align="start">
        <Button
          testID="calendar-google-btn"
          variant="secondary"
          size="sm"
          icon="logo-google"
          accentColor={VENDOR_BRANDS.google}
          onPress={() => openExternal(googleUrl)}
        >
          Google
        </Button>
        <Button
          testID="calendar-outlook-btn"
          variant="secondary"
          size="sm"
          icon="logo-microsoft"
          accentColor={VENDOR_BRANDS.microsoft}
          onPress={() => openExternal(outlookUrl)}
        >
          Outlook
        </Button>
        <Button
          testID="calendar-ics-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="download-outline"
          onPress={() => void downloadIcs()}
          accessibilityLabel={t("booking.calendar.icsA11y")}
        >
          .ics
        </Button>
      </ButtonRow>
    </View>
  );
}
