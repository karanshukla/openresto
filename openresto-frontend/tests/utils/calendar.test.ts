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

  it("includes section and table when provided", () => {
    const { googleUrl } = buildCalendarUrls({
      ...input,
      sectionName: "Patio",
      tableName: "T4",
    });
    expect(googleUrl).toContain(encodeURIComponent("Section: Patio"));
    expect(googleUrl).toContain(encodeURIComponent("Table: T4"));
  });

  it("omits section and table lines when not provided", () => {
    const { googleUrl } = buildCalendarUrls(input);
    expect(googleUrl).not.toContain(encodeURIComponent("Section:"));
    expect(googleUrl).not.toContain(encodeURIComponent("Table:"));
  });

  it("uses the provided endTime for the event duration instead of a hardcoded hour", () => {
    const { googleUrl } = buildCalendarUrls({ ...input, endTime: "2026-10-10T13:30:00Z" });
    expect(googleUrl).toContain(`${fmtCal(new Date(input.date))}/20261010T133000Z`);
  });

  it("falls back to a 60-minute event when endTime is not provided", () => {
    const { googleUrl } = buildCalendarUrls(input);
    expect(googleUrl).toContain(`${fmtCal(new Date(input.date))}/20261010T130000Z`);
  });

  it("omits LOCATION when restaurantAddress is empty", () => {
    let capturedContent = "";
    const origBlob = global.Blob;
    global.Blob = function (parts: any) {
      capturedContent = parts[0];
      return {} as Blob;
    } as any;

    const mockAnchor = { href: "", download: "", click: jest.fn() };
    jest.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob-url");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { downloadIcs } = buildCalendarUrls({ ...input, restaurantAddress: "" });
    downloadIcs();

    global.Blob = origBlob;
    jest.restoreAllMocks();

    expect(capturedContent).not.toContain("LOCATION:");
  });

  it("folds long lines in the ICS output", () => {
    let capturedContent = "";
    const origBlob = global.Blob;
    global.Blob = function (parts: any) {
      capturedContent = parts[0];
      return {} as Blob;
    } as any;

    const mockAnchor = { href: "", download: "", click: jest.fn() };
    jest.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob-url");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const longName = "A".repeat(200);
    const { downloadIcs } = buildCalendarUrls({ ...input, restaurantName: longName });
    downloadIcs();

    global.Blob = origBlob;
    jest.restoreAllMocks();

    expect(capturedContent).toContain("\r\n ");
  });

  it("downloadIcs creates and clicks a link", () => {
    // Mock DOM API
    const mockAnchor = {
      href: "",
      download: "",
      click: jest.fn(),
    };
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockReturnValue(mockAnchor as any);
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
