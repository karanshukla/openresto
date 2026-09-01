/**
 * @jest-environment jsdom
 */
import { Platform } from "react-native";
import { buildCalendarUrls, buildIcs, deliverIcs, fmtCal } from "@/utils/calendar";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

jest.mock("expo-file-system", () => {
  const create = jest.fn();
  const write = jest.fn();
  const FileMock = jest.fn(function (this: Record<string, unknown>, _dir: unknown, name: string) {
    this.uri = `file:///cache/${name}`;
    this.create = create;
    this.write = write;
  });
  return {
    File: Object.assign(FileMock, { calls: { create, write } }),
    Paths: { cache: { uri: "file:///cache/" } },
  };
});

jest.mock("expo-sharing", () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));

const fileMock = File as unknown as jest.Mock & {
  calls: { create: jest.Mock; write: jest.Mock };
};

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

describe("calendar utility - fmtCal", () => {
  it("formats date correctly", () => {
    const d = new Date("2026-10-10T12:00:00Z");
    expect(fmtCal(d)).toBe("20261010T120000Z");
  });
});

const input = {
  bookingRef: "REF123",
  date: "2026-10-10T12:00:00Z",
  seats: 2,
  restaurantName: "Test Resto",
  restaurantAddress: "123 Main St",
};

describe("calendar utility - buildCalendarUrls", () => {
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
});

describe("calendar utility - buildIcs", () => {
  it("omits LOCATION when restaurantAddress is empty", () => {
    expect(buildIcs({ ...input, restaurantAddress: "" })).not.toContain("LOCATION:");
  });

  it("folds long lines in the ICS output", () => {
    const longName = "A".repeat(200);
    expect(buildIcs({ ...input, restaurantName: longName })).toContain("\r\n ");
  });

  it("names the event and keys it to the booking reference", () => {
    const ics = buildIcs(input);
    expect(ics).toContain("SUMMARY:Reservation at Test Resto");
    expect(ics).toContain("UID:REF123@openresto");
  });
});

describe("calendar utility - deliverIcs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("web");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("downloads through a generated anchor on web", async () => {
    const mockAnchor = { href: "", download: "", click: jest.fn() };
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob-url");
    const revokeObjectURLSpy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await deliverIcs(input);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.download).toBe("reservation-REF123.ics");
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob-url");
    // Nothing is written to disk on web — the browser owns the download.
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("buildCalendarUrls' downloadIcs is the same delivery", async () => {
    const mockAnchor = { href: "", download: "", click: jest.fn() };
    jest
      .spyOn(document, "createElement")
      .mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob-url");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await buildCalendarUrls(input).downloadIcs();

    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it("writes the file to the cache directory and shares it on native", async () => {
    setPlatform("ios");

    await deliverIcs(input);

    expect(fileMock).toHaveBeenCalledWith(Paths.cache, "reservation-REF123.ics");
    // Overwrite rather than fail — the same booking's .ics may be shared twice.
    expect(fileMock.calls.create).toHaveBeenCalledWith({ overwrite: true });
    expect(fileMock.calls.write).toHaveBeenCalledWith(buildIcs(input));
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/reservation-REF123.ics", {
      mimeType: "text/calendar",
      UTI: "com.apple.ical.ics",
    });
  });
});
