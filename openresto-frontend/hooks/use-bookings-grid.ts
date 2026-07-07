import { useCallback, useEffect, useState } from "react";
import {
  adminGetTables,
  getAdminBookings,
  type BookingDetailDto,
  type SectionWithTables,
} from "@/api/admin";
import { isoDate } from "@/utils/formatters";

export interface UseBookingsGridOptions {
  /** Currently selected restaurant; the grid (re)loads when this changes. */
  restaurantId: number | null;
  /** Active view mode — the grid only loads on restaurant change when this is "timetable". */
  viewMode: "timetable" | "list";
}

export interface UseBookingsGridResult {
  gridDate: Date;
  gridSections: SectionWithTables[];
  gridBookings: BookingDetailDto[];
  gridLoading: boolean;
  /** Imperative reload — used by the screen after mutations and restaurant switches. */
  loadGrid: (restaurantId: number, date: Date) => Promise<void>;
  /** Step the grid date by ±1 day and reload. */
  handleGridDateChange: (delta: number) => void;
  /** Reset the grid date to today and reload (if a restaurant is selected). */
  resetToToday: () => void;
}

/**
 * Timetable grid state + fetch for the admin bookings screen.
 *
 * Owns: the selected grid day, the fetched sections/bookings for that day, and
 * the loading flag. Exposes imperative loaders so the screen can reconcile the
 * grid after mutations (cancel/create/edit) and restaurant switches.
 *
 * The screen retains `viewMode` and `selectedRestaurantId` (orchestration state)
 * and passes them in; this hook does not decide *when* to show the grid, only
 * how its data is fetched and navigated.
 */
export function useBookingsGrid({
  restaurantId,
  viewMode,
}: UseBookingsGridOptions): UseBookingsGridResult {
  const [gridDate, setGridDate] = useState(new Date());
  const [gridSections, setGridSections] = useState<SectionWithTables[]>([]);
  const [gridBookings, setGridBookings] = useState<BookingDetailDto[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const loadGrid = useCallback(async (rid: number, date: Date) => {
    setGridLoading(true);
    const [sections, bookingsForDate] = await Promise.all([
      adminGetTables(rid),
      getAdminBookings(rid, isoDate(date)),
    ]);
    setGridSections(sections);
    setGridBookings(bookingsForDate);
    setGridLoading(false);
  }, []);

  const handleGridDateChange = useCallback(
    (delta: number) => {
      setGridDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + delta);
        if (restaurantId) loadGrid(restaurantId, next);
        return next;
      });
    },
    [restaurantId, loadGrid]
  );

  const resetToToday = useCallback(() => {
    const today = new Date();
    setGridDate(today);
    if (restaurantId) loadGrid(restaurantId, today);
  }, [restaurantId, loadGrid]);

  // Load timetable on mount / when the selected restaurant changes (only in timetable view).
  useEffect(() => {
    if (restaurantId && viewMode === "timetable") {
      loadGrid(restaurantId, gridDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return {
    gridDate,
    gridSections,
    gridBookings,
    gridLoading,
    loadGrid,
    handleGridDateChange,
    resetToToday,
  };
}
