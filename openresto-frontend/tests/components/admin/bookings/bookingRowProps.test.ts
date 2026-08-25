import i18n from "@/i18n";
import { describeBookingRow } from "@/components/admin/bookings/bookingRowProps";

const t = i18n.getFixedT("en");

describe("describeBookingRow", () => {
  const base = {
    customerName: "Alice",
    customerEmail: "alice@example.com",
    date: "2026-10-10T18:00:00Z",
    seats: 2,
  };

  it("includes the table name when the booking has one", () => {
    const label = describeBookingRow({ ...base, tableName: "T4" }, t);
    expect(label).toContain("T4");
    expect(label).toContain("Alice");
    expect(label).toContain("2 guests");
  });

  it("omits the table clause when the booking has no table (unassigned)", () => {
    const label = describeBookingRow({ ...base, tableName: null }, t);
    expect(label).not.toContain("null");
    expect(label.endsWith("2 guests")).toBe(true);
  });

  it("falls back to the customer email when no name is set", () => {
    const label = describeBookingRow({ ...base, customerName: null, tableName: undefined }, t);
    expect(label).toContain("alice@example.com");
  });
});
