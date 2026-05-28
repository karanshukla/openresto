import { ScrollView, View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/theme/theme";
import { SectionWithTables, BookingDetailDto } from "@/api/admin";
import { styles } from "./bookings.styles";

function buildTimeSlots(openTime: string, closeTime: string) {
  const startHour = parseInt(openTime.split(":")[0], 10);
  const endHour = parseInt(closeTime.split(":")[0], 10);
  return Array.from({ length: Math.max(endHour - startHour, 1) }, (_, i) => {
    const h = startHour + i;
    const label = h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
    return { hour: h, label };
  });
}

export const COL_W = 68;
export const ROW_H = 48;
export const LABEL_W = 110;
export const HEADER_H = 36;
export const SECTION_H = 26;

function getRestaurantHour(dateStr: string, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(dateStr));
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  } catch {
    return new Date(dateStr).getHours();
  }
}

export function AvailabilityGrid({
  sections,
  bookings,
  isDark,
  onBookingPress,
  openTime = "11:00",
  closeTime = "23:00",
  timezone = "UTC",
}: {
  sections: SectionWithTables[];
  bookings: BookingDetailDto[];
  isDark: boolean;
  onBookingPress: (b: BookingDetailDto) => void;
  openTime?: string;
  closeTime?: string;
  timezone?: string;
}) {
  const timeSlots = buildTimeSlots(openTime, closeTime);
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const headerBg = isDark ? "#28292b" : "#f4f5f6";
  const sectionBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const availBg = isDark ? "#18191b" : "#fafafa";
  const bookedBg = isDark ? `rgba(220,38,38,0.22)` : `rgba(220,38,38,0.1)`;
  const mutedColor = colors.muted;

  function bookingForCell(tableId: number, hour: number): BookingDetailDto | undefined {
    return bookings.find(
      (b) => b.tableId === tableId && getRestaurantHour(b.date, timezone) === hour
    );
  }

  const totalW = LABEL_W + timeSlots.length * COL_W;

  if (sections.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Ionicons name="grid-outline" size={32} color={mutedColor} />
        <ThemedText style={[{ color: mutedColor, marginTop: 10, fontSize: 14 }]}>
          No tables found. Add sections and tables in Location Manager.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width: totalW }}>
        {/* Column headers */}
        <View
          style={[
            {
              flexDirection: "row",
              height: HEADER_H,
              backgroundColor: headerBg,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
            },
          ]}
        >
          <View
            style={[
              {
                width: LABEL_W,
                height: HEADER_H,
                justifyContent: "center",
                paddingHorizontal: 10,
                borderRightWidth: 1,
                borderRightColor: borderColor,
              },
            ]}
          >
            <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>TABLE</ThemedText>
          </View>
          {timeSlots.map(({ hour, label }) => (
            <View
              key={hour}
              style={[
                {
                  width: COL_W,
                  height: HEADER_H,
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeftWidth: 1,
                  borderLeftColor: borderColor,
                },
              ]}
            >
              <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Sections + table rows */}
        {sections.map((section) => (
          <View key={section.id}>
            {/* Section divider */}
            <View
              style={[
                {
                  height: SECTION_H,
                  flexDirection: "row",
                  backgroundColor: sectionBg,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                  alignItems: "center",
                  paddingHorizontal: 10,
                },
              ]}
            >
              <ThemedText style={[styles.gridSectionLabel, { color: mutedColor }]}>
                {section.name.toUpperCase()}
              </ThemedText>
            </View>

            {/* Table rows */}
            {section.tables.map((table) => (
              <View
                key={table.id}
                style={[
                  {
                    flexDirection: "row",
                    height: ROW_H,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                {/* Fixed label */}
                <View
                  style={[
                    {
                      width: LABEL_W,
                      height: ROW_H,
                      justifyContent: "center",
                      paddingHorizontal: 10,
                      borderRightWidth: 1,
                      borderRightColor: borderColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.gridTableName} numberOfLines={1}>
                    {table.name ?? `T${table.id}`}
                  </ThemedText>
                  <ThemedText style={[styles.gridTableSeats, { color: mutedColor }]}>
                    {table.seats}p
                  </ThemedText>
                </View>

                {/* Time slot cells */}
                {timeSlots.map(({ hour }) => {
                  const booking = bookingForCell(table.id, hour);
                  return (
                    <Pressable
                      key={hour}
                      style={[
                        {
                          width: COL_W,
                          height: ROW_H,
                          alignItems: "center",
                          justifyContent: "center",
                          borderLeftWidth: 1,
                          borderLeftColor: borderColor,
                          paddingHorizontal: 3,
                        },
                        booking
                          ? {
                              backgroundColor: bookedBg,
                              borderLeftColor: "#dc2626",
                              borderLeftWidth: 2,
                            }
                          : { backgroundColor: availBg },
                      ]}
                      onPress={() => booking && onBookingPress(booking)}
                      disabled={!booking}
                    >
                      {booking ? (
                        <View style={{ alignItems: "center", gap: 1 }}>
                          <Ionicons name="person" size={10} color="#dc2626" />
                          <ThemedText style={styles.gridCellEmail} numberOfLines={1}>
                            {booking.customerEmail?.split("@")[0]}
                          </ThemedText>
                          <ThemedText style={[styles.gridCellSeats, { color: mutedColor }]}>
                            {booking.seats}p
                          </ThemedText>
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
