import { fmtCal, buildCalendarUrls } from "@/utils/calendar";

describe("Lookup Calendar", () => {
  const input = {
    bookingRef: "sunny-pepper",
    date: "2026-06-15T19:30:00.000Z",
    seats: 2,
    specialRequests: "Quiet table",
    restaurantName: "Sushi Spot",
    restaurantAddress: "456 Ocean Ave",
  };

  describe("Google Calendar URL", () => {
    it("includes correct date range", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("dates=20260615T193000Z/20260615T203000Z");
    });

    it("includes restaurant name in title", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("text=Reservation%20at%20Sushi%20Spot");
    });

    it("includes address as location", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("location=456%20Ocean%20Ave");
    });
  });

  describe("Outlook Calendar URL", () => {
    it("includes ISO start and end dates", () => {
      const { outlookUrl } = buildCalendarUrls(input);
      expect(outlookUrl).toContain("startdt=2026-06-15T19:30:00.000Z");
      expect(outlookUrl).toContain("enddt=2026-06-15T20:30:00.000Z");
    });
  });

  describe("iCal date format", () => {
    it("formats midnight correctly", () => {
      expect(fmtCal(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe("20260101T000000Z");
    });

    it("formats end of year correctly", () => {
      expect(fmtCal(new Date(Date.UTC(2026, 11, 31, 23, 59, 59)))).toBe("20261231T235959Z");
    });

    it("pads single-digit values", () => {
      expect(fmtCal(new Date(Date.UTC(2026, 1, 3, 5, 5, 5)))).toBe("20260203T050505Z");
    });

    it("handles leap years", () => {
      expect(fmtCal(new Date(Date.UTC(2024, 1, 29, 12, 0, 0)))).toBe("20240229T120000Z");
    });

    it("always ends with Z", () => {
      const result = fmtCal(new Date(Date.UTC(2026, 5, 15, 10, 30, 0)));
      expect(result).toMatch(/Z$/);
    });
  });

  describe("Calendar description content", () => {
    it("includes all booking details", () => {
      const { googleUrl } = buildCalendarUrls(input);
      const details = decodeURIComponent(googleUrl.split("details=")[1].split("&")[0]);
      expect(details).toContain("Booking ref: sunny-pepper");
      expect(details).toContain("Guests: 2");
      expect(details).toContain("Requests: Quiet table");
    });

    it("handles missing optional fields", () => {
      const { googleUrl } = buildCalendarUrls({
        ...input,
        specialRequests: undefined,
        restaurantAddress: "",
      });
      const details = decodeURIComponent(googleUrl.split("details=")[1].split("&")[0]);
      expect(details).not.toContain("Address:");
      expect(details).not.toContain("Requests:");
    });
  });
});
