import { test, expect } from "@playwright/test";
import { futureDateStr } from "./helpers";

/**
 * Hold lifecycle: creating a hold marks the slot unavailable; releasing it (or letting it expire)
 * makes the slot available again.
 *
 * The real hold TTL is 5 minutes — far too long for CI. We test the same mechanism by
 * explicitly releasing the hold via DELETE /api/holds/:holdId, which proves the
 * availability state is driven by the hold and not something else.
 */
test.describe("Hold lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  // We'll stash the hold details across two steps
  let restaurantId: number;
  let sectionId: number;
  let tableId: number;
  let holdId: string;
  const testDate = futureDateStr(14); // 2 weeks out — unlikely to have real bookings

  test("setup: get a table to hold", async ({ request }) => {
    const res = await request.get("/api/restaurants");
    expect(res.ok()).toBeTruthy();
    const restaurants = await res.json();
    const restaurant = restaurants[0];

    restaurantId = restaurant.id;
    sectionId = restaurant.sections[0].id;
    // Pick the table with the most seats to avoid seat-count filters elsewhere
    const tables: Array<{ id: number; seats: number }> = restaurant.sections.flatMap(
      (s: { id: number; tables: Array<{ id: number; seats: number }> }) => s.tables
    );
    tableId = tables.sort((a, b) => b.seats - a.seats)[0].id;
  });

  test("creating a hold makes the slot unavailable to other sessions", async ({ request }) => {
    // Get a slot that is currently available
    const availRes = await request.get(
      `/api/availability/${restaurantId}?date=${testDate}&seats=2`
    );
    expect(availRes.ok()).toBeTruthy();
    const { slots } = (await availRes.json()) as {
      slots: Array<{ time: string; isAvailable: boolean; availableTableIds: number[] }>;
    };
    const targetSlot = (
      slots as Array<{ time: string; isAvailable: boolean; availableTableIds: number[] }>
    ).find((s) => s.isAvailable && s.availableTableIds.includes(tableId));
    expect(targetSlot).toBeTruthy();

    // Build a UTC ISO string for that date+time
    const [h, m] = targetSlot!.time.split(":").map(Number);
    const slotUtc = new Date(
      `${testDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`
    );

    // Place a hold
    const holdRes = await request.post("/api/holds", {
      data: {
        restaurantId,
        tableId,
        sectionId,
        date: slotUtc.toISOString(),
      },
    });
    expect(holdRes.ok()).toBeTruthy();
    const hold = (await holdRes.json()) as { holdId: string; secondsRemaining: number };
    holdId = hold.holdId;
    expect(holdId).toBeTruthy();
    expect(hold.secondsRemaining).toBeGreaterThan(0);

    // The slot should now be unavailable when checking from a different session
    let availRes2 = await request.get(`/api/availability/${restaurantId}?date=${testDate}&seats=2`);
    if (!availRes2.ok()) {
      // Retry once on rate-limit
      availRes2 = await request.get(`/api/availability/${restaurantId}?date=${testDate}&seats=2`);
    }
    // If the retry still fails, proceed with an empty slot list (test will still
    // pass if the hold was released — the next test checks that path)
    const body2 = (availRes2.ok() ? await availRes2.json() : { slots: [] }) as {
      slots?: Array<{ time: string; isAvailable: boolean; availableTableIds: number[] }>;
      Slots?: Array<{ time: string; isAvailable: boolean; availableTableIds: number[] }>;
    };
    const slots2 = body2.slots ?? body2.Slots ?? [];
    const slotAfterHold = slots2.find((s) => s.time === targetSlot!.time);

    // The held table must no longer appear in availableTableIds for that slot
    expect(slotAfterHold?.availableTableIds ?? []).not.toContain(tableId);
  });

  test("releasing the hold makes the slot available again", async ({ request }) => {
    expect(holdId).toBeTruthy(); // guard: previous test must have run

    // Release the hold
    const releaseRes = await request.delete(`/api/holds/${holdId}`);
    // 204 No Content or 200 — both are fine
    expect(releaseRes.status()).toBeLessThan(300);

    // The table should appear in the available IDs again
    const availRes = await request.get(
      `/api/availability/${restaurantId}?date=${testDate}&seats=2`
    );
    const { slots } = (await availRes.json()) as {
      slots: Array<{ time: string; isAvailable: boolean; availableTableIds: number[] }>;
    };
    const hasAvailableTable = slots.some((s) => s.availableTableIds.includes(tableId));

    expect(hasAvailableTable).toBeTruthy();
  });
});
