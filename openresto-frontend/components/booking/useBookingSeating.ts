import { useEffect, useState } from "react";
import type { RestaurantDto, TableDto } from "@/api/restaurants";
import type { TimeSlotDto } from "@/api/availability";
import { groupDropdownLabel, groupedTableIds } from "@/utils/tableGroups";

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
  /** Drops any live hold when the seating choice changes out from under it. */
  releaseCurrentHold: () => void;
}

/**
 * Section / table / combinable-group selection for the booking form.
 *
 * "Any section" (id 0) is the default: the form hides the table dropdown and the server picks.
 * Otherwise the hook keeps a concrete table selected, re-picking whenever availability, party
 * size or section changes so the form never sits on a table the API would reject.
 */
export function useBookingSeating({
  restaurant,
  seats,
  currentSlot,
  releaseCurrentHold,
}: UseBookingSeatingArgs) {
  const [sectionId, setSectionId] = useState<number>(ANY_SECTION_ID);
  const [tableId, setTableId] = useState<number | undefined>();
  // Combinable-group selection (#274): when set, the diner picked a combined-table group from the
  // dropdown instead of a single table. Mutually exclusive with tableId in the submit payload.
  const [tableGroupId, setTableGroupId] = useState<number | undefined>();

  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const allGroups = restaurant.groups ?? [];
  // Tables flagged combinable. They stay individually bookable (#242) — this only deprioritizes
  // them in the suggested-table pick below.
  const groupedTableIdSet = groupedTableIds(allGroups);

  // Largest capacity at this location — the best single table OR the best combinable group (#274).
  // Parties above this can't be seated even with pushed-together tables and must contact the
  // restaurant directly. Computed client-side from the nested restaurant payload — no extra fetch.
  const maxSingleTableSeats = allTables.length > 0 ? Math.max(...allTables.map((t) => t.seats)) : 0;
  const maxGroupSeats =
    allGroups.length > 0 ? Math.max(...allGroups.map((g) => g.combinedSeats)) : 0;
  const maxTableCapacity = Math.max(maxSingleTableSeats, maxGroupSeats);
  const partyTooLarge = maxTableCapacity > 0 && seats > maxTableCapacity;

  // "Any section" is the default option (value 0); concrete sections follow. When selected,
  // the form hides the table dropdown and lets the server pick the best available table.
  const sectionOptions = [
    { label: "Any section", value: ANY_SECTION_ID },
    ...restaurant.sections.map((s) => ({ label: s.name, value: s.id })),
  ];
  const isAutoAssign = sectionId === ANY_SECTION_ID;
  const tablesInSection = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
  // Groups belong to the picked section only when *every* member sits in it — booking a group is
  // booking all its tables, so one member elsewhere means the party would be split across sections.
  // TableDto carries no sectionId, so membership is resolved through the section's own table ids.
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
    // Lower bound: table must seat the party. Upper bound: when the restaurant caps spare
    // seats, drop tables too large for the group. Mirrors the server-side eligible-table
    // filter (AvailabilityService) so the auto-suggested pick is always one the API accepts.
    let eligible = pool.filter(
      (t) =>
        t.seats >= seatCount &&
        (restaurant.maxTableOversizeSeats == null ||
          t.seats <= seatCount + restaurant.maxTableOversizeSeats)
    );
    if (availableIds && availableIds.length > 0) {
      eligible = eligible.filter((t) => availableIds.includes(t.id));
    }
    // Smallest fitting table, but a combinable table loses to an ungrouped one of the same size —
    // the same deprioritization the server applies when auto-assigning, so the suggested default
    // leaves the mergeable tables free for the parties that need them pushed together.
    eligible.sort((a, b) => {
      if (a.seats !== b.seats) return a.seats - b.seats;
      return Number(groupedTableIdSet.has(a.id)) - Number(groupedTableIdSet.has(b.id));
    });
    return eligible[0]?.id ?? pool[0]?.id;
  }

  // Auto-assign mode: the server picks the table, so no pre-selection here.
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
    releaseCurrentHold();
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

  const eligibleTables = tablesInSection
    .filter(
      (t) =>
        t.seats >= seats &&
        (restaurant.maxTableOversizeSeats == null ||
          t.seats <= seats + restaurant.maxTableOversizeSeats)
    )
    .filter((t) => {
      if (currentSlot) {
        return availableTableIds.includes(t.id);
      }
      return true;
    })
    .sort((a, b) => a.seats - b.seats);

  // Combinable groups (#274): a group is selectable when it sits in the picked section, its combined
  // capacity fits the party, it respects the optional oversize cap, and (when availability data is
  // present) the group's id is in the slot's availableGroupIds.
  const eligibleGroups = groupsInSection
    .filter(
      (g) =>
        g.combinedSeats >= seats &&
        (restaurant.maxTableOversizeSeats == null ||
          g.combinedSeats <= seats + restaurant.maxTableOversizeSeats)
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
