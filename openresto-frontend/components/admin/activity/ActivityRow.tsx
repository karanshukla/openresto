import type { ReactNode } from "react";
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
  /** The recessed surface the expanded detail sits on, a step back from `cardBg`. */
  detailBg: string;
  mutedColor: string;
  textColor: string;
}

/** One line of the expanded detail: a muted label beside whatever the value is made of. */
function DetailRow({
  label,
  mutedColor,
  children,
}: {
  label: string;
  mutedColor: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: mutedColor }]}>{label}</ThemedText>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
}

function DetailTextRow({
  label,
  value,
  mutedColor,
  textColor,
}: {
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <DetailRow label={label} mutedColor={mutedColor}>
      <ThemedText style={[styles.detailValueText, { color: textColor }]}>{value}</ThemedText>
    </DetailRow>
  );
}

/**
 * One side of a diff. A masked value is deliberately not styled like the real ones it sits
 * beside — it takes a padlock and the muted italic of an annotation, so a reviewer reads it as
 * "this was withheld" rather than as the string that was actually stored.
 */
function ChangeValue({
  value,
  color,
  mutedColor,
}: {
  value: string | null;
  color: string;
  mutedColor: string;
}) {
  const masked = isRedacted(value);
  return (
    <View style={styles.changeValue}>
      {masked ? <Icon name="lock-closed-outline" size="xs" color={mutedColor} /> : null}
      <ThemedText
        style={[
          styles.detailValueText,
          { color: masked ? mutedColor : color },
          masked && styles.redacted,
        ]}
      >
        {formatChangeValue(value)}
      </ThemedText>
    </View>
  );
}

function ChangeRow({
  change,
  mutedColor,
  textColor,
}: {
  change: AuditChangeDto;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <DetailRow label={change.field} mutedColor={mutedColor}>
      <ChangeValue value={change.before} color={mutedColor} mutedColor={mutedColor} />
      <ThemedText style={[styles.detailValueText, { color: mutedColor }]}>→</ThemedText>
      <ChangeValue value={change.after} color={textColor} mutedColor={mutedColor} />
    </DetailRow>
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
 * replaces the action label rather than stacking under it, that a summary-less row falls back
 * to its target label and then to the request line, and that the expanded detail reads as
 * labelled When/Request/From/Device rows with Device dropped when there is no user agent.
 */
export function ActivityRow({
  entry,
  expanded,
  onToggle,
  isLast,
  borderColor,
  cardBg,
  detailBg,
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
          style={[styles.detail, { borderTopColor: borderColor, backgroundColor: detailBg }]}
        >
          {entry.changes.length > 0 && (
            <View style={[styles.changesBlock, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.changesHeading, { color: mutedColor }]}>
                Changes
              </ThemedText>
              {entry.changes.map((change) => (
                <ChangeRow
                  key={change.field}
                  change={change}
                  mutedColor={mutedColor}
                  textColor={textColor}
                />
              ))}
            </View>
          )}

          <View style={styles.metaBlock}>
            <DetailTextRow
              label="When"
              value={formatExactTime(entry.occurredAt)}
              mutedColor={mutedColor}
              textColor={textColor}
            />
            <DetailTextRow
              label="Request"
              value={httpLine(entry)}
              mutedColor={mutedColor}
              textColor={textColor}
            />
            <DetailTextRow
              label="From"
              value={entry.ipAddress ?? "unknown"}
              mutedColor={mutedColor}
              textColor={textColor}
            />
            {entry.userAgent ? (
              <DetailTextRow
                label="Device"
                value={entry.userAgent}
                mutedColor={mutedColor}
                textColor={textColor}
              />
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

export default ActivityRow;
