import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { hexToRgba } from "@/utils/colors";
import { relativeTime } from "@/utils/formatters";
import { roleLabel } from "@/constants/roles";
import type { AdminAuditEntryDto, AuditChangeDto } from "@/api/audit";
import {
  actionIcon,
  actionLabel,
  actorName,
  formatChangeValue,
  formatExactTime,
  httpLine,
  isRedacted,
  statusColor,
} from "@/utils/audit";
import { styles } from "./ActivityRow.styles";

export interface ActivityRowProps {
  entry: AdminAuditEntryDto;
  expanded: boolean;
  onToggle: (id: number) => void;
  isLast: boolean;
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  textColor: string;
}

function ChangeLine({
  change,
  mutedColor,
  textColor,
}: {
  change: AuditChangeDto;
  mutedColor: string;
  textColor: string;
}) {
  const valueStyle = (value: string | null) => [
    styles.changeValue,
    { color: isRedacted(value) ? mutedColor : textColor },
    isRedacted(value) && styles.redacted,
  ];

  return (
    <View style={styles.changeRow}>
      <ThemedText style={[styles.changeField, { color: mutedColor }]}>{change.field}</ThemedText>
      <ThemedText style={valueStyle(change.before)}>{formatChangeValue(change.before)}</ThemedText>
      <ThemedText style={[styles.changeArrow, { color: mutedColor }]}>→</ThemedText>
      <ThemedText style={valueStyle(change.after)}>{formatChangeValue(change.after)}</ThemedText>
    </View>
  );
}

/**
 * One recorded admin action. Collapsed it answers who did what and when; expanded it adds the
 * field-level diff and the raw request, which is what a reviewer needs when the summary alone
 * doesn't settle the question.
 *
 * A summary already names its own verb and target, so printing the action label above it says
 * everything twice ("Signed in" over "Signed in"). The label is what the row falls back to
 * without one, and the second line then carries whatever else identifies the row — a target,
 * or for an entry audited only by the middleware floor (`http.post`), the path itself.
 *
 * @see [activity.test.tsx](../../../tests/app/admin/activity.test.tsx) — pins that a summary
 * replaces the action label rather than stacking under it, and that a summary-less row falls
 * back to its target label and then to the request line.
 */
export function ActivityRow({
  entry,
  expanded,
  onToggle,
  isLast,
  borderColor,
  cardBg,
  mutedColor,
  textColor,
}: ActivityRowProps) {
  const label = actionLabel(entry.action);
  const actor = actorName(entry);
  const tone = statusColor(entry.statusCode);
  const meta = [actor, roleLabel(entry.actorRole), relativeTime(entry.occurredAt)]
    .filter(Boolean)
    .join(" · ");

  const primary = entry.summary || label;
  const secondary = entry.summary ? null : entry.targetLabel || httpLine(entry);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: cardBg },
        !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
      ]}
    >
      <Pressable
        testID="activity-row"
        onPress={() => onToggle(entry.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={[label, entry.targetLabel, entry.summary, meta]
          .filter(Boolean)
          .join(", ")}
        style={styles.row}
      >
        <View style={[styles.icon, { backgroundColor: hexToRgba(tone, 0.1) }]}>
          <Icon name={actionIcon(entry.action)} size="lg" color={tone} />
        </View>

        <View style={styles.body}>
          <ThemedText style={styles.primary}>{primary}</ThemedText>

          {secondary ? (
            <ThemedText style={[styles.secondary, { color: mutedColor }]}>{secondary}</ThemedText>
          ) : null}

          <ThemedText style={[styles.meta, { color: mutedColor }]}>{meta}</ThemedText>
        </View>

        <View style={[styles.statusPill, { borderColor: tone }]}>
          <ThemedText style={[styles.statusText, { color: tone }]}>
            {String(entry.statusCode)}
          </ThemedText>
        </View>

        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} color={mutedColor} />
      </Pressable>

      {expanded && (
        <View
          testID={`activity-detail-${entry.id}`}
          style={[styles.detail, { borderTopColor: borderColor }]}
        >
          <ThemedText style={[styles.detailHeading, { color: mutedColor }]}>
            {formatExactTime(entry.occurredAt)}
          </ThemedText>

          {entry.changes.length > 0 && (
            <View style={styles.detailBlock}>
              <ThemedText style={[styles.detailHeading, { color: mutedColor }]}>Changes</ThemedText>
              {entry.changes.map((change) => (
                <ChangeLine
                  key={change.field}
                  change={change}
                  mutedColor={mutedColor}
                  textColor={textColor}
                />
              ))}
            </View>
          )}

          <View style={styles.detailBlock}>
            <ThemedText style={[styles.detailHeading, { color: mutedColor }]}>Request</ThemedText>
            <ThemedText style={[styles.monoLine, { color: textColor }]}>
              {httpLine(entry)}
            </ThemedText>
            <ThemedText style={[styles.monoLine, { color: mutedColor }]}>
              {`IP ${entry.ipAddress ?? "unknown"}`}
            </ThemedText>
            {entry.userAgent ? (
              <ThemedText style={[styles.monoLine, { color: mutedColor }]}>
                {entry.userAgent}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

export default ActivityRow;
