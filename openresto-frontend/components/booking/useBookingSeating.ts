import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RestaurantDto } from "@/api/restaurants";
import type { TimeSlotDto } from "@/api/availability";
import { groupDropdownLabel } from "@/utils/tableGroups";
import { seatsAtLeast } from "@/utils/seating";
import { onlineGroups, onlineSections } from "@/utils/walkIn";

export const ANY_SECTION_ID = 0;

/** "Any table" in the table dropdown: the server picks a table in the chosen section. */
export const ANY_TABLE_VALUE = 0;

/**
 * Groups and tables share one dropdown, so group ids ride in as negatives — table ids are
 * always positive and 0 is "Any table", leaving the negative range free.
 */
export const groupSelectValue = (groupId: number) => -groupId;
export const isGroupSelectValue = (value: number) => value < 0;
export const groupIdFromSelectValue = (value: number) => -value;

export interface UseBookingSeatingArgs {
  restaurant: RestaurantDto;
  seats: number;
  /** The slot the diner has picked, if availability has loaded for it. */
  currentSlot: TimeSlotDto | undefined;
}

/**
 * Section / table / combinable-group selection for the booking form.
 *
 * Until the guest picks a table or a group the server assigns one: across the restaurant under
 * "Any section" (the default), otherwise within the chosen section. The table dropdown is only
 * offered once a section is chosen, and never at a location whose guests may not choose tables.
 *
 * Selection is all it owns. A live hold on the previous pick is invalidated by the new pick
 * flowing into `useTableHold`, which releases or replaces it — never by this hook reaching back.
 */
export function useBookingSeating({ restaurant, seats, currentSlot }: UseBookingSeatingArgs) {
  const { t } = useTranslation();
  const [sectionId, setSectionId] = useState<number>(ANY_SECTION_ID);
  const [tableId, setTableId] = useState<number | undefined>();
  /** Mutually exclusive with `tableId` in the submit payload: a booking reserves one or the other. */
  const [tableGroupId, setTableGroupId] = useState<number | undefined>();

  const sections = onlineSections(restaurant);
  const allTables = sections.flatMap((s) => s.tables);
  const allGroups = onlineGroups(restaurant);

  // Parties above the best single table *or* the best combinable group can't be seated even with
  // tables pushed together, and have to contact the restaurant directly.
  const maxSingleTableSeats = allTables.length > 0 ? Math.max(...allTables.map((t) => t.seats)) : 0;
  const maxGroupSeats =
    allGroups.length > 0 ? Math.max(...allGroups.map((g) => g.combinedSeats)) : 0;
  const maxTableCapacity = Math.max(maxSingleTableSeats, maxGroupSeats);
  const partyTooLarge = maxTableCapacity > 0 && seats > maxTableCapacity;

  const sectionOptions = [
    { label: t("booking.seating.anySectionLabel"), value: ANY_SECTION_ID },
    ...sections.map((s) => ({ label: s.name, value: s.id })),
  ];
  const isAnySection = sectionId === ANY_SECTION_ID;
  const canChooseTable = restaurant.guestsChooseTable !== false && !isAnySection;
  const isAutoAssign = tableId === undefined && tableGroupId === undefined;
  /** The section the server assigns within; undefined when it may pick from any section. */
  const autoAssignSectionId = isAutoAssign && !isAnySection ? sectionId : undefined;

  const tablesInSection = sections.find((s) => s.id === sectionId)?.tables ?? allTables;
  // A group belongs to the picked section only when *every* member sits in it: booking a group
  // books all its tables, so one member elsewhere would split the party across sections. TableDto
  // carries no sectionId, hence resolving membership through the section's own table ids.
  const sectionTableIds = new Set(tablesInSection.map((t) => t.id));
  const groupsInSection = isAnySection
    ? allGroups
    : allGroups.filter(
        (g) => g.members.length > 0 && g.members.every((m) => sectionTableIds.has(m.id))
      );

  const availableTableIds = currentSlot?.availableTableIds ?? [];
  const availableGroupIds = currentSlot?.availableGroupIds ?? [];

  // A pick the slot no longer offers falls back to "Any table", not to a table the guest never chose.
  useEffect(() => {
    if (!currentSlot) return;
    if (tableId !== undefined && !availableTableIds.includes(tableId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTableId(undefined);
    }
    if (tableGroupId !== undefined && !availableGroupIds.includes(tableGroupId)) {
      setTableGroupId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlot, tableId, tableGroupId]);

  const selectSection = (value: number) => {
    setSectionId(value);
    setTableId(undefined);
    setTableGroupId(undefined);
  };

  const eligibleTables = seatsAtLeast(
    tablesInSection,
    seats,
    restaurant.maxTableOversizeSeats,
    (t) => t.seats
  )
    .filter((t) => (currentSlot ? availableTableIds.includes(t.id) : true))
    .sort((a, b) => a.seats - b.seats);

  const eligibleGroups = seatsAtLeast(
    groupsInSection,
    seats,
    restaurant.maxTableOversizeSeats,
    (g) => g.combinedSeats
  )
    .filter((g) => (currentSlot ? availableGroupIds.includes(g.id) : true))
    .sort((a, b) => a.combinedSeats - b.combinedSeats);

  const hasEligibleUnits = eligibleTables.length > 0 || eligibleGroups.length > 0;
  const tableOptions = [
    { label: t("booking.seating.anyTableLabel"), value: ANY_TABLE_VALUE },
    ...eligibleTables.map((table) => ({
      label: `${table.name ?? t("booking.seating.tableFallbackName", { id: table.id })} ${t("booking.seating.seatsSuffix", { count: table.seats })}`,
      value: table.id,
    })),
    ...eligibleGroups.map((g) => ({ label: groupDropdownLabel(g), value: groupSelectValue(g.id) })),
  ];

  /** Applies a pick from the combined table/group dropdown, keeping the two mutually exclusive. */
  const selectSeatingUnit = (value: number) => {
    if (value === ANY_TABLE_VALUE) {
      setTableGroupId(undefined);
      setTableId(undefined);
    } else if (isGroupSelectValue(value)) {
      setTableGroupId(groupIdFromSelectValue(value));
      setTableId(undefined);
    } else {
      setTableGroupId(undefined);
      setTableId(value);
    }
  };

  return {
    allTables,
    allGroups,
    sectionId,
    selectSection,
    tableId,
    tableGroupId,
    selectSeatingUnit,
    isAnySection,
    isAutoAssign,
    autoAssignSectionId,
    canChooseTable,
    sectionOptions,
    tableOptions,
    hasEligibleUnits,
    maxTableCapacity,
    partyTooLarge,
  };
}
