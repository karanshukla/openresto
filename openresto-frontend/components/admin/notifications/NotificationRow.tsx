import { Platform, Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { hexToRgba } from "@/utils/colors";
import { theme } from "@/theme/theme";
import type { AdminNotificationDto } from "@/api/notifications";
import { TYPE_ICONS, TYPE_LABELS, formatBookingDate, relativeTime } from "@/utils/notifications";
import { styles } from "@/components/admin/notifications/notifications.styles";

export interface NotificationRowProps {
  notification: AdminNotificationDto;
  isPinned: boolean;
  isLast: boolean;
  webTouchActive: boolean;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
  primaryColor: string;
  onRowTap: (n: AdminNotificationDto) => void;
  onTogglePin: (id: number) => void;
  onMarkRead: (id: number) => void;
  onMarkUnread: (id: number) => void;
  onRequestDelete: (id: number) => void;
  onSwipeDelete: (id: number) => void;
}

/**
 * A single notification row — rendered inside both the pinned and unpinned
 * lists. Wraps a swipeable (delete via swipe on touch devices) around a row
 * showing the type icon, title, customer/meta, and pin/read/delete actions.
 *
 * Extracted from the notifications screen for decomposition; presentational,
 * owns no state.
 */
export function NotificationRow({
  notification: n,
  isPinned,
  isLast,
  webTouchActive,
  borderColor,
  mutedColor,
  isDark,
  primaryColor,
  onRowTap,
  onTogglePin,
  onMarkRead,
  onMarkUnread,
  onRequestDelete,
  onSwipeDelete,
}: NotificationRowProps) {
  const typeIcon = TYPE_ICONS[n.type];
  const meta = [
    n.restaurantName,
    n.seats > 0 ? `${n.seats} guest${n.seats !== 1 ? "s" : ""}` : null,
    n.bookingDate ? formatBookingDate(n.bookingDate) : null,
    relativeTime(n.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      enabled={(Platform.OS !== "web" || webTouchActive) && !isPinned}
      renderLeftActions={() => (
        <View style={styles.swipeDeleteBg}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.swipeDeleteBg}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </View>
      )}
      onSwipeableOpen={() => onSwipeDelete(n.id)}
    >
      <Pressable
        onPress={() => onRowTap(n)}
        style={(state) => [
          styles.notifRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
          (state as { hovered?: boolean }).hovered && {
            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
          },
        ]}
      >
        {/* Unread accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: !n.isRead ? primaryColor : "transparent" }]}
        />

        {/* Type icon */}
        <View style={[styles.notifIcon, { backgroundColor: hexToRgba(typeIcon.color, 0.1) }]}>
          <Ionicons name={typeIcon.name} size={18} color={typeIcon.color} />
        </View>

        {/* Text content */}
        <View style={styles.notifBody}>
          <View style={styles.notifTitleRow}>
            <ThemedText style={styles.notifType}>{TYPE_LABELS[n.type]}</ThemedText>
            {n.bookingRef ? (
              <ThemedText style={[styles.notifRef, { color: mutedColor }]}>
                #{n.bookingRef}
              </ThemedText>
            ) : null}
            {!n.isRead && <View style={[styles.unreadPip, { backgroundColor: primaryColor }]} />}
          </View>

          {n.type !== "RestaurantNearlyFull" && n.customerName ? (
            <ThemedText style={styles.notifName}>{n.customerName}</ThemedText>
          ) : null}

          <ThemedText style={[styles.notifMeta, { color: mutedColor }]}>{meta}</ThemedText>
        </View>

        {/* Action buttons — nested Pressables so they don't trigger row navigation */}
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => onTogglePin(n.id)}
            hitSlop={6}
            style={[
              styles.actionPinBtn,
              {
                backgroundColor: isPinned
                  ? primaryColor
                  : isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <ThemedText style={[styles.actionText, { color: isPinned ? "#fff" : mutedColor }]}>
              {isPinned ? "Unpin" : "Pin"}
            </ThemedText>
          </Pressable>
          {n.isRead ? (
            <Pressable
              onPress={() => onMarkUnread(n.id)}
              hitSlop={6}
              style={[
                styles.actionToggleBtn,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <ThemedText style={[styles.actionText, { color: mutedColor }]}>
                Mark Unread
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onMarkRead(n.id)}
              hitSlop={6}
              style={[
                styles.actionToggleBtn,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <ThemedText style={[styles.actionText, { color: mutedColor }]}>Mark Read</ThemedText>
            </Pressable>
          )}
          <Pressable
            testID={`delete-notif-${n.id}`}
            onPress={() => onRequestDelete(n.id)}
            hitSlop={6}
            style={[
              styles.actionDeleteBtn,
              { backgroundColor: hexToRgba(theme.colors.error, 0.12) },
            ]}
          >
            <Ionicons name="trash-outline" size={13} color={theme.colors.error} />
          </Pressable>
        </View>

        {/* Navigate arrow */}
        {(n.bookingId != null || n.type === "RestaurantNearlyFull") && (
          <Ionicons name="chevron-forward" size={15} color={mutedColor} />
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
