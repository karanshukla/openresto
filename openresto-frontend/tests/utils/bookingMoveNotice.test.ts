import { composeBookingMoveNotice } from "@/utils/bookingMoveNotice";

const NY = "America/New_York";
// 2026-09-02T23:00Z is 19:00 EDT the same day; 2026-09-03T16:30Z is 12:30 EDT the next.
const FROM = "2026-09-02T23:00:00Z";
const TO = "2026-09-03T16:30:00Z";

/** Mirrors the composer's own format options, so the assertions pin the zone, not the locale. */
const inZone = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  });

const details = {
  restaurantName: "Paddy's Pub",
  bookingRef: "crispy-basil-truffle",
  customerName: "Ada Lovelace",
  fromIso: FROM,
  toIso: TO,
  timezone: NY,
};

describe("composeBookingMoveNotice", () => {
  // A rename or a seat-count change must never offer the admin an email announcing a change of
  // time that did not happen.
  it("composes nothing when the sitting did not move", () => {
    expect(composeBookingMoveNotice({ ...details, toIso: FROM })).toBeNull();
  });

  it("composes nothing when the two instants differ only in how they are written", () => {
    expect(
      composeBookingMoveNotice({ ...details, fromIso: FROM, toIso: "2026-09-02T19:00:00-04:00" })
    ).toBeNull();
  });

  it("composes a notice when the sitting moved", () => {
    const notice = composeBookingMoveNotice(details)!;

    expect(notice.subject).toBe("Your booking at Paddy's Pub has moved");
    expect(notice.body).toContain("Hi Ada Lovelace,");
    expect(notice.body).toContain("crispy-basil-truffle");
  });

  // The guest turns up at the restaurant's clock, not the admin's. An admin covering a location
  // in another zone would otherwise send a time nobody is expecting them at.
  //
  // Asserted against a locally formatted reference rather than a literal string: the output is
  // locale-dependent (en-GB gives "Wednesday 2 September at 19:00 GMT-4", en-US gives
  // "Wednesday, September 2 at 7:00 PM EDT"), so a literal would pass on CI and fail on a
  // developer's machine. What is being pinned is the zone reaching the formatter, not the format.
  it("renders both sittings in the restaurant's timezone", () => {
    const notice = composeBookingMoveNotice({ ...details, timezone: "Asia/Tokyo" })!;

    expect(notice.body).toContain(`Previously: ${inZone(FROM, "Asia/Tokyo")}`);
    expect(notice.body).toContain(`Now: ${inZone(TO, "Asia/Tokyo")}`);
  });

  it("renders a different time for a location in a different zone", () => {
    const tokyo = composeBookingMoveNotice({ ...details, timezone: "Asia/Tokyo" })!;
    const london = composeBookingMoveNotice({ ...details, timezone: "Europe/London" })!;

    expect(tokyo.body).not.toEqual(london.body);
  });

  it("still names a zone when the location has none recorded", () => {
    const notice = composeBookingMoveNotice({ ...details, timezone: null })!;

    expect(notice.body).toMatch(/Previously: .+\d/);
    expect(notice.body).toContain("Now:");
  });

  // An unknown IANA id would otherwise throw out of the save handler that composes this.
  it("falls back rather than throwing on an unusable timezone", () => {
    const notice = composeBookingMoveNotice({ ...details, timezone: "Not/A/Zone" })!;

    expect(notice.body).toContain("Previously:");
  });

  it("greets without a name when the booking has none", () => {
    const notice = composeBookingMoveNotice({ ...details, customerName: null })!;

    expect(notice.body).toContain("Hello,");
    expect(notice.body).not.toContain("Hi ,");
  });

  it("omits the reference line when the booking has no reference", () => {
    const notice = composeBookingMoveNotice({ ...details, bookingRef: "  " })!;

    expect(notice.body).not.toContain("booking reference");
  });

  it("names the venue generically when the location has no name", () => {
    const notice = composeBookingMoveNotice({ ...details, restaurantName: null })!;

    expect(notice.subject).toBe("Your booking at the restaurant has moved");
  });
});
