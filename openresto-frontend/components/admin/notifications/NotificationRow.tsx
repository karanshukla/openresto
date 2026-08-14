import { Platform, Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { ThemedText } from "@/components/themed-text";
import { hexToRgba } from "@/utils/colors";
import { theme } from "@/theme/theme";
import type { AdminNotificationDto } from "@/api/notifications";
import { TYPE_ICONS, TYPE_LABELS, formatBookingDate, relativeTime } from "@/utils/notifications";
import { styles } from "@/components/admin/notifications/notifications.styles";
import { Icon } from "@/components/common/Icon";

export interface NotificationRowProps {
  notification: AdminNotificationDto;
  isPinned: boolean;
  isLast: boolean;
  webTouchActive: boolean;
  borderColor: string;
  cardBg: string;
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
 */
export function NotificationRow({
  notification: n,
  isPinned,
  isLast,
  webTouchActive,
  borderColor,
  cardBg,
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

  // The swipe-to-delete panels sit behind the row, so the row has to paint its own surface
  // or they bleed through as red edges. Rendering them only where swiping is possible keeps
  // them out of the pointer-driven layout entirely.
  const swipeEnabled = (Platform.OS !== "web" || webTouchActive) && !isPinned;
  const renderSwipeDelete = () => (
    <View style={styles.swipeDeleteBg}>
      <Icon name="trash-outline" size="xl" color="#fff" />
    </View>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      enabled={swipeEnabled}
      renderLeftActions={swipeEnabled ? renderSwipeDelete : undefined}
      renderRightActions={swipeEnabled ? renderSwipeDelete : undefined}
      onSwipeableOpen={() => onSwipeDelete(n.id)}
    >
      <Pressable
        onPress={() => onRowTap(n)}
        accessibilityRole="button"
        accessibilityLabel={[
          n.isRead ? "Read" : "Unread",
          TYPE_LABELS[n.type],
          n.customerName,
          n.bookingRef ? `booking ${n.bookingRef}` : null,
          meta,
        ]
          .filter(Boolean)
          .join(", ")}
        style={(state) => [
          styles.notifRow,
          { backgroundColor: cardBg },
          !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
          (state as { hovered?: boolean }).hovered && {
            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
          },
        ]}
      >
        <View
          style={[styles.accentBar, { backgroundColor: !n.isRead ? primaryColor : "transparent" }]}
        />

        <View style={[styles.notifIcon, { backgroundColor: hexToRgba(typeIcon.color, 0.1) }]}>
          <Icon name={typeIcon.name} size="lg" color={typeIcon.color} />
        </View>

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
            accessibilityRole="button"
            accessibilityLabel={isPinned ? "Unpin notification" : "Pin notification"}
            accessibilityState={{ selected: isPinned }}
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
              accessibilityRole="button"
              accessibilityLabel="Mark notification unread"
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
              accessibilityRole="button"
              accessibilityLabel="Mark notification read"
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
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
            hitSlop={6}
            style={[
              styles.actionDeleteBtn,
              { backgroundColor: hexToRgba(theme.colors.error, 0.12) },
            ]}
          >
            <Icon name="trash-outline" size={13} color={theme.colors.error} />
            <ThemedText style={[styles.actionText, { color: theme.colors.error }]}>
              Delete
            </ThemedText>
          </Pressable>
        </View>

        {(n.bookingId != null || n.type === "RestaurantNearlyFull") && (
          <Icon name="chevron-forward" size={15} color={mutedColor} />
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}
