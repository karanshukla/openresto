import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { BookingDto } from "@/api/bookings";
import { styles } from "./BookingGuestDetails.styles";

interface BookingGuestDetailsProps {
  booking: BookingDto;
  mutedColor: string;
}

/**
 * Who the booking is under, and anything they asked for. Two quiet lines rather than a
 * disclosure: name and email are short enough that hiding them costs a tap and saves no
 * height. Special requests stay visible whenever they exist — this same card is the
 * confirmation screen, and an allergy note behind a chevron is one people won't open to
 * check. An empty request is omitted rather than rendered as "None".
 */
export default function BookingGuestDetails({ booking, mutedColor }: BookingGuestDetailsProps) {
  const requests = booking.specialRequests?.trim();

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Icon name="person-outline" size={15} color={mutedColor} style={styles.icon} />
        <View style={styles.content}>
          <ThemedText style={styles.primary}>
            {booking.customerName ? `Booked under ${booking.customerName}` : "Booked with"}
          </ThemedText>
          <ThemedText style={[styles.secondary, { color: mutedColor }]}>
            {booking.customerEmail}
          </ThemedText>
        </View>
      </View>

      {requests ? (
        <View style={styles.row}>
          <Icon name="chatbubble-outline" size={15} color={mutedColor} style={styles.icon} />
          <View style={styles.content}>
            <ThemedText style={[styles.label, { color: mutedColor }]}>Special requests</ThemedText>
            <ThemedText style={styles.secondaryStrong}>{requests}</ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}
