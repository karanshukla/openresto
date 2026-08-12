import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "../themed-text";
import { Icon } from "@/components/common/Icon";
import WalkInDaysBanner from "./WalkInDaysBanner";
import { SectionHeading } from "./BookingFormFields";
import type { RestaurantDto } from "@/api/restaurants";
import { styles } from "./BookingForm.styles";

/**
 * The pieces BookingForm builds, handed to whichever layout is rendering them. The two
 * layouts differ only in arrangement — every part is wired up identically by the form.
 */
export interface BookingFormParts {
  guestsField: (label?: string) => ReactNode;
  dateField: ReactNode;
  timePickerField: (label?: string) => ReactNode;
  sectionField: ReactNode;
  tableField: ReactNode;
  nameField: ReactNode;
  emailField: ReactNode;
  requestsField: (label: string) => ReactNode;
  /** The times picker, or the closed-day / walk-in-day notice standing in for it. */
  timesContent: ReactNode;
  timesBlock: (label: string) => ReactNode;
  timezoneHint: ReactNode;
  largePartyBanner: ReactNode;
  largePartyModal: ReactNode;
  holdBanner: ReactNode;
  holdRequiredHint: ReactNode;
  confirmButton: ReactNode;
  gdprText: string;
}

interface LayoutProps {
  restaurant: RestaurantDto;
  parts: BookingFormParts;
  mutedColor: string;
  primaryColor: string;
  borderColor: string;
}

/**
 * Drawer layout: one column, grouped into headed sections, with the seating controls behind
 * a disclosure — most diners take the auto-assigned table and never open it.
 */
export function BookingFormDrawerLayout({
  restaurant,
  parts,
  mutedColor,
  primaryColor,
  borderColor,
  loadingAvailability,
  seatingOpen,
  onToggleSeating,
}: LayoutProps & {
  loadingAvailability: boolean;
  seatingOpen: boolean;
  onToggleSeating: () => void;
}) {
  const divider = <View style={[styles.divider, { backgroundColor: borderColor }]} />;

  return (
    <View style={styles.drawerForm}>
      <WalkInDaysBanner restaurant={restaurant} />

      <View style={styles.drawerSection}>
        <SectionHeading
          label="Party & date"
          busy={loadingAvailability}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
        />
        <View style={styles.drawerRow}>
          <View style={styles.drawerRowHalf}>{parts.guestsField()}</View>
          <View style={styles.drawerRowHalf}>{parts.dateField}</View>
        </View>
        {parts.timesContent}
        {parts.timezoneHint}
        {parts.timePickerField("Exact time")}
        {parts.largePartyBanner}
      </View>

      {divider}

      <View style={styles.drawerSection}>
        <SectionHeading label="Your details" mutedColor={mutedColor} primaryColor={primaryColor} />
        {parts.nameField}
        {parts.emailField}
        {parts.requestsField("Special requests / allergies")}
      </View>

      {divider}

      <View style={styles.drawerSection}>
        <Pressable
          testID="seating-disclosure-toggle"
          onPress={() => {
            Haptics.selectionAsync();
            onToggleSeating();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: seatingOpen }}
          style={styles.disclosureToggle}
        >
          {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => {
            const accent = hovered || pressed ? primaryColor : mutedColor;
            return (
              <>
                <Icon name="options-outline" size="md" color={accent} />
                <ThemedText style={[styles.disclosureText, { color: accent }]}>
                  Choose a section or table
                </ThemedText>
                <Icon name={seatingOpen ? "chevron-up" : "chevron-down"} size="md" color={accent} />
              </>
            );
          }}
        </Pressable>
        {seatingOpen && (
          <>
            {parts.sectionField}
            {parts.tableField}
          </>
        )}
      </View>

      {divider}
      {parts.holdBanner}

      <View style={styles.drawerFooter}>
        <ThemedText style={[styles.gdpr, { color: mutedColor }]}>{parts.gdprText}</ThemedText>
        {parts.confirmButton}
        {parts.holdRequiredHint}
      </View>
      {parts.largePartyModal}
    </View>
  );
}

/**
 * Inline page layout: the same fields paired into rows, which collapse to a single column
 * below the mobile breakpoint. The hold banner rides alongside the email field when there
 * are two columns to ride in.
 */
export function BookingFormInlineLayout({
  restaurant,
  parts,
  mutedColor,
  isTwoColumn,
}: Omit<LayoutProps, "primaryColor" | "borderColor"> & { isTwoColumn: boolean }) {
  const half = isTwoColumn ? styles.fieldHalf : undefined;
  const rowStyle = isTwoColumn ? styles.fieldRow : styles.fieldRowStacked;

  return (
    <View style={styles.form}>
      <WalkInDaysBanner restaurant={restaurant} />
      {parts.timesBlock("Popular Times")}

      <View testID="booking-field-row" style={rowStyle}>
        <View style={half}>{parts.guestsField("Number of Guests")}</View>
        <View style={half}>{parts.dateField}</View>
      </View>

      {parts.largePartyBanner}

      <View testID="booking-field-row" style={rowStyle}>
        <View style={half}>{parts.timePickerField()}</View>
        <View style={half}>{parts.sectionField}</View>
      </View>

      {parts.timezoneHint}

      <View testID="booking-field-row" style={rowStyle}>
        <View style={half}>{parts.tableField}</View>
        <View style={half}>{parts.nameField}</View>
      </View>

      <View
        testID="booking-field-row"
        style={isTwoColumn ? [styles.fieldRow, styles.fieldRowStretch] : styles.fieldRowStacked}
      >
        <View style={[styles.field, half]}>
          {parts.emailField}
          {isTwoColumn && <View style={styles.holdPush}>{parts.holdBanner}</View>}
        </View>
        <View style={half}>{parts.requestsField("Special Requests / Allergies")}</View>
      </View>

      {!isTwoColumn && parts.holdBanner}

      <ThemedText style={[styles.gdpr, { color: mutedColor }]}>{parts.gdprText}</ThemedText>

      {parts.confirmButton}
      {parts.holdRequiredHint}
      {parts.largePartyModal}
    </View>
  );
}
