import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildCalendarUrls } from "@/utils/calendar";
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
 */
export default function CalendarActions(props: CalendarActionsProps) {
  const { colors } = useAppTheme();
  const { googleUrl, outlookUrl, downloadIcs } = buildCalendarUrls(props);

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>ADD TO CALENDAR</ThemedText>
      <ButtonRow align="start">
        <Button
          testID="calendar-google-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="logo-google"
          onPress={/* istanbul ignore next */ () => window.open(googleUrl, "_blank")}
        >
          Google
        </Button>
        <Button
          testID="calendar-outlook-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="calendar-outline"
          onPress={/* istanbul ignore next */ () => window.open(outlookUrl, "_blank")}
        >
          Outlook
        </Button>
        <Button
          testID="calendar-ics-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="download-outline"
          onPress={downloadIcs}
          accessibilityLabel="Download .ics for Apple Calendar, Thunderbird and others"
        >
          Download .ics
        </Button>
      </ButtonRow>
    </View>
  );
}
