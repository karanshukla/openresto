import { fmtCal, buildCalendarUrls } from "@/utils/calendar";

describe("Booking Confirmation Calendar", () => {
  const input = {
    bookingRef: "test-booking-123",
    date: "2026-03-28T19:30:00.000Z",
    seats: 4,
    specialRequests: "Window seat preferred",
    restaurantName: "Test Restaurant",
    restaurantAddress: "123 Test Street, Test City",
  };

  describe("Google Calendar URL", () => {
    it("includes correct date range", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("dates=20260328T193000Z/20260328T203000Z");
    });

    it("includes reservation title", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("text=Reservation%20at%20Test%20Restaurant");
    });

    it("includes location", () => {
      const { googleUrl } = buildCalendarUrls(input);
      expect(googleUrl).toContain("location=123%20Test%20Street");
    });
  });

  describe("Outlook Calendar URL", () => {
    it("includes ISO date format", () => {
      const { outlookUrl } = buildCalendarUrls(input);
      expect(outlookUrl).toContain("startdt=2026-03-28T19:30:00.000Z");
      expect(outlookUrl).toContain("enddt=2026-03-28T20:30:00.000Z");
    });

    it("includes subject", () => {
      const { outlookUrl } = buildCalendarUrls(input);
      expect(outlookUrl).toContain("subject=Reservation%20at%20Test%20Restaurant");
    });
  });

  describe("Calendar description", () => {
    it("includes booking details in description", () => {
      const { googleUrl } = buildCalendarUrls(input);
      const details = decodeURIComponent(googleUrl.split("details=")[1].split("&")[0]);
      expect(details).toContain("Booking ref: test-booking-123");
      expect(details).toContain("Guests: 4");
      expect(details).toContain("Address: 123 Test Street, Test City");
      expect(details).toContain("Requests: Window seat preferred");
    });

    it("omits empty optional fields", () => {
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

  describe("Date formatting", () => {
    it("formats UTC dates for different booking times", () => {
      const cases = [
        { date: "2026-01-15T18:00:00.000Z", expected: "20260115T180000Z" },
        { date: "2026-06-20T20:30:00.000Z", expected: "20260620T203000Z" },
        { date: "2026-12-25T12:00:00.000Z", expected: "20261225T120000Z" },
      ];
      cases.forEach(({ date, expected }) => {
        expect(fmtCal(new Date(date))).toBe(expected);
      });
    });
  });
});
