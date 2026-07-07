import {
  relativeTime,
  formatBookingDate,
  arrayBufferToBase64,
  PAGE_SIZE,
  PIN_STORAGE_KEY,
  TYPE_LABELS,
  TYPE_FILTERS,
} from "@/utils/notifications";

describe("relativeTime", () => {
  it("returns 'just now' for <1 minute", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it("returns minutes for <1 hour", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("5m ago");
  });

  it("returns hours for <1 day", () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(relativeTime(iso)).toBe("3h ago");
  });

  it("returns days for >=1 day", () => {
    const iso = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(relativeTime(iso)).toBe("2d ago");
  });
});

describe("formatBookingDate", () => {
  it("produces a locale string with weekday + day + month + time", () => {
    const result = formatBookingDate("2026-07-15T19:30:00Z");
    // Locale-dependent, so just assert it contains a weekday + a numeric day.
    expect(result).toMatch(/Wed/);
    expect(result).toMatch(/15/);
  });
});

describe("arrayBufferToBase64", () => {
  it("encodes ASCII bytes correctly", () => {
    const buf = new Uint8Array([72, 105]).buffer; // "Hi"
    expect(arrayBufferToBase64(buf)).toBe(btoa("Hi"));
  });
});

describe("constants", () => {
  it("PAGE_SIZE is 20", () => {
    expect(PAGE_SIZE).toBe(20);
  });

  it("PIN_STORAGE_KEY is the expected localStorage key", () => {
    expect(PIN_STORAGE_KEY).toBe("openresto_pinned_notifs");
  });

  it("TYPE_LABELS covers all three notification types", () => {
    expect(TYPE_LABELS.BookingCreated).toBe("New Booking");
    expect(TYPE_LABELS.BookingCancelled).toBe("Booking Cancelled");
    expect(TYPE_LABELS.RestaurantNearlyFull).toBe("Nearly Full");
  });

  it("TYPE_FILTERS has an 'All Types' empty-value option plus one per type", () => {
    expect(TYPE_FILTERS[0]).toEqual({ label: "All Types", value: "" });
    expect(TYPE_FILTERS).toHaveLength(4);
    const values = TYPE_FILTERS.map((f) => f.value).filter(Boolean);
    expect(values).toEqual(
      expect.arrayContaining(["BookingCreated", "BookingCancelled", "RestaurantNearlyFull"])
    );
  });
});
