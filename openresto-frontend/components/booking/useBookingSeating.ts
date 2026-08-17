import { useEffect, useState } from "react";
import type { RestaurantDto, TableDto } from "@/api/restaurants";
import type { TimeSlotDto } from "@/api/availability";
import { groupDropdownLabel, groupedTableIds } from "@/utils/tableGroups";
import { seatsAtLeast } from "@/utils/seating";

export const ANY_SECTION_ID = 0;

/**
 * Groups and tables share one dropdown, so group ids ride in as negatives — table ids are
 * always positive and section 0 is "Any", leaving the negative range free.
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
 * "Any section" (id 0) is the default: the form hides the table dropdown and the server picks.
 * Otherwise the hook keeps a concrete table selected, re-picking whenever availability, party
 * size or section changes so the form never sits on a table the API would reject.
 *
 * Selection is all it owns. A live hold on the previous pick is invalidated by the new pick
 * flowing into `useTableHold`, which releases or replaces it — never by this hook reaching back.
 */
export function useBookingSeating({ restaurant, seats, currentSlot }: UseBookingSeatingArgs) {
  const [sectionId, setSectionId] = useState<number>(ANY_SECTION_ID);
  const [tableId, setTableId] = useState<number | undefined>();
  /** Mutually exclusive with `tableId` in the submit payload: a booking reserves one or the other. */
  const [tableGroupId, setTableGroupId] = useState<number | undefined>();

  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const allGroups = restaurant.groups ?? [];
  const groupedTableIdSet = groupedTableIds(allGroups);

  // Parties above the best single table *or* the best combinable group can't be seated even with
  // tables pushed together, and have to contact the restaurant directly.
  const maxSingleTableSeats = allTables.length > 0 ? Math.max(...allTables.map((t) => t.seats)) : 0;
  const maxGroupSeats =
    allGroups.length > 0 ? Math.max(...allGroups.map((g) => g.combinedSeats)) : 0;
  const maxTableCapacity = Math.max(maxSingleTableSeats, maxGroupSeats);
  const partyTooLarge = maxTableCapacity > 0 && seats > maxTableCapacity;

  const sectionOptions = [
    { label: "Any section", value: ANY_SECTION_ID },
    ...restaurant.sections.map((s) => ({ label: s.name, value: s.id })),
  ];
  const isAutoAssign = sectionId === ANY_SECTION_ID;
  const tablesInSection = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
  // A group belongs to the picked section only when *every* member sits in it: booking a group
  // books all its tables, so one member elsewhere would split the party across sections. TableDto
  // carries no sectionId, hence resolving membership through the section's own table ids.
  const sectionTableIds = new Set(tablesInSection.map((t) => t.id));
  const groupsInSection = isAutoAssign
    ? allGroups
    : allGroups.filter(
        (g) => g.members.length > 0 && g.members.every((m) => sectionTableIds.has(m.id))
      );

  const availableTableIds = currentSlot?.availableTableIds ?? [];
  const availableGroupIds = currentSlot?.availableGroupIds ?? [];

  function bestTableFor(seatCount: number, availableIds?: number[], candidateTables?: TableDto[]) {
    const pool = candidateTables ?? allTables;
    let eligible = seatsAtLeast(pool, seatCount, restaurant.maxTableOversizeSeats, (t) => t.seats);
    if (availableIds && availableIds.length > 0) {
      eligible = eligible.filter((t) => availableIds.includes(t.id));
    }
    // Smallest fitting table, and a combinable table loses to an ungrouped one of the same size —
    // the deprioritization the server applies when auto-assigning, so the suggested default leaves
    // mergeable tables free for the parties that need them pushed together.
    eligible.sort((a, b) => {
      if (a.seats !== b.seats) return a.seats - b.seats;
      return Number(groupedTableIdSet.has(a.id)) - Number(groupedTableIdSet.has(b.id));
    });
    return eligible[0]?.id ?? pool[0]?.id;
  }

  useEffect(() => {
    if (isAutoAssign) {
      if (tableId !== undefined) setTableId(undefined);
      if (tableGroupId !== undefined) setTableGroupId(undefined);
      return;
    }
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    if (availableTableIds.length > 0) {
      if (!tableId || !availableTableIds.includes(tableId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTableId(bestTableFor(seats, availableTableIds, candidates));
      }
    } else {
      setTableId(bestTableFor(seats, undefined, candidates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTableIds, seats, isAutoAssign]);

  useEffect(() => {
    if (isAutoAssign) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTableId(undefined);
      setTableGroupId(undefined);
      return;
    }
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTableId(
      bestTableFor(seats, availableTableIds.length > 0 ? availableTableIds : undefined, candidates)
    );
    setTableGroupId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

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

  const tableOptions = [
    ...eligibleTables.map((table) => ({
      label: `${table.name ?? `Table ${table.id}`} (${table.seats} seats)`,
      value: table.id,
    })),
    ...eligibleGroups.map((g) => ({ label: groupDropdownLabel(g), value: groupSelectValue(g.id) })),
  ];

  /** Applies a pick from the combined table/group dropdown, keeping the two mutually exclusive. */
  const selectSeatingUnit = (value: number) => {
    if (isGroupSelectValue(value)) {
      setTableGroupId(groupIdFromSelectValue(value));
      setTableId(undefined);
    } else {
      setTableGroupId(undefined);
      setTableId(value);
    }
  };

  return {
    allTables,
    sectionId,
    setSectionId,
    tableId,
    tableGroupId,
    selectSeatingUnit,
    isAutoAssign,
    sectionOptions,
    tableOptions,
    maxTableCapacity,
    partyTooLarge,
  };
}
