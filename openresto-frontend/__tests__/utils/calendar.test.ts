/**
 * @jest-environment jsdom
 */
import { buildCalendarUrls, fmtCal } from "@/utils/calendar";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

describe("calendar utility - fmtCal", () => {
  it("formats date correctly", () => {
    const d = new Date("2026-10-10T12:00:00Z");
    expect(fmtCal(d)).toBe("20261010T120000Z");
  });
});

describe("calendar utility - buildCalendarUrls", () => {
  const input = {
    bookingRef: "REF123",
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    restaurantName: "Test Resto",
    restaurantAddress: "123 Main St",
  };

  it("returns google and outlook urls", () => {
    const { googleUrl, outlookUrl } = buildCalendarUrls(input);
    expect(googleUrl).toContain("calendar.google.com");
    expect(googleUrl).toContain("REF123");
    expect(outlookUrl).toContain("outlook.live.com");
  });

  it("handles optional specialRequests", () => {
    const { googleUrl } = buildCalendarUrls({ ...input, specialRequests: "Window seat" });
    expect(googleUrl).toContain(encodeURIComponent("Window seat"));
  });

  it("downloadIcs creates and clicks a link", () => {
    // Mock DOM API
    const mockAnchor = {
      href: "",
      download: "",
      click: jest.fn(),
    };
    const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    const createObjectURLSpy = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob-url");
    const revokeObjectURLSpy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    
    const { downloadIcs } = buildCalendarUrls(input);
    downloadIcs();

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.download).toBe("reservation-REF123.ics");
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob-url");

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
