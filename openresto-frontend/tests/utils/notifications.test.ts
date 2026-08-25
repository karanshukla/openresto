import {
  relativeTime,
  formatBookingDate,
  arrayBufferToBase64,
  PAGE_SIZE,
  PIN_STORAGE_KEY,
  getTypeLabels,
  getTypeFilters,
} from "@/utils/notifications";
import { setActiveLocale } from "@/utils/locale";
import i18n from "@/i18n";

const t = i18n.getFixedT("en");

// Re-exported from utils/formatters — see formatters.test.ts for why the locale is pinned
// rather than left to follow the device.
describe("relativeTime", () => {
  beforeEach(() => {
    setActiveLocale("en");
  });

  afterEach(() => {
    setActiveLocale(undefined);
  });

  it("returns 'now' for <1 minute", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("now");
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

  it("getTypeLabels covers all three notification types", () => {
    const labels = getTypeLabels(t);
    expect(labels.BookingCreated).toBe("New Booking");
    expect(labels.BookingCancelled).toBe("Booking Cancelled");
    expect(labels.RestaurantNearlyFull).toBe("Nearly Full");
  });

  it("getTypeFilters has an 'All Types' empty-value option plus one per type", () => {
    const filters = getTypeFilters(t);
    expect(filters[0]).toEqual({ label: "All Types", value: "" });
    expect(filters).toHaveLength(4);
    const values = filters.map((f) => f.value).filter(Boolean);
    expect(values).toEqual(
      expect.arrayContaining(["BookingCreated", "BookingCancelled", "RestaurantNearlyFull"])
    );
  });

  it("getTypeLabels translates independently of the locale getTypeFilters resolves", () => {
    const fr = i18n.getFixedT("fr");
    expect(getTypeLabels(fr).BookingCreated).toBe("Nouvelle réservation");
    expect(getTypeLabels(t).BookingCreated).toBe("New Booking");
  });
});
