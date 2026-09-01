import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export function fmtCal(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * RFC 5545 line folding: max 75 octets per line, continuation with CRLF + space.
 *
 * `TextEncoder` is a global on Hermes as of React Native 0.86, so the octet count is the same
 * one the browser computes — no polyfill and no platform split.
 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  let result = "";
  let lineBytes = 0;
  let chunk = "";

  for (const char of line) {
    const charLen = new TextEncoder().encode(char).length;
    if (lineBytes + charLen > (result === "" ? 75 : 74)) {
      result += (result === "" ? "" : "\r\n ") + chunk;
      chunk = char;
      lineBytes = charLen;
    } else {
      chunk += char;
      lineBytes += charLen;
    }
  }
  /* istanbul ignore else */
  if (chunk) result += (result === "" ? /* istanbul ignore next */ "" : "\r\n ") + chunk;
  return result;
}

/** Escape special characters in iCal text fields */
function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

interface CalendarInput {
  bookingRef: string;
  date: string;
  endTime?: string;
  seats: number;
  specialRequests?: string;
  restaurantName: string;
  restaurantAddress: string;
  sectionName?: string;
  tableName?: string;
}

interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
}

function resolveEvent(input: CalendarInput): CalendarEvent {
  const startDate = new Date(input.date);
  const endDate = input.endTime
    ? new Date(input.endTime)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  const origin =
    typeof window !== "undefined" ? window.location?.origin : /* istanbul ignore next */ "";
  const description = [
    origin ? `Booked via the URL: (${origin})` : "",
    `Booking reference: ${input.bookingRef}`,
    `Guests: ${input.seats}`,
    input.sectionName ? `Section: ${input.sectionName}` : "",
    input.tableName ? `Table: ${input.tableName}` : "",
    input.restaurantAddress ? `Address: ${input.restaurantAddress}` : "",
    input.specialRequests ? `Requests: ${input.specialRequests}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: `Reservation at ${input.restaurantName}`,
    description,
    location: input.restaurantAddress,
    startDate,
    endDate,
  };
}

/**
 * The .ics document itself, as text. Pure — no Blob, no filesystem — so web can wrap it in a
 * download and native can write it to disk from the same bytes rather than each platform
 * assembling its own calendar file.
 *
 * @see [calendar.test.ts](../tests/utils/calendar.test.ts) — pins the folded long line and
 * the omitted LOCATION when the restaurant has no address.
 */
export function buildIcs(input: CalendarInput): string {
  const { title, description, location, startDate, endDate } = resolveEvent(input);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//OpenResto//Booking//EN",
    "BEGIN:VEVENT",
    `DTSTAMP:${fmtCal(new Date())}`,
    `DTSTART:${fmtCal(startDate)}`,
    `DTEND:${fmtCal(endDate)}`,
    `SUMMARY:${escapeIcal(title)}`,
    `DESCRIPTION:${escapeIcal(description)}`,
    ...(location ? [`LOCATION:${escapeIcal(location)}`] : []),
    `UID:${input.bookingRef}@openresto`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(foldLine)
    .join("\r\n");
}

function icsFileName(bookingRef: string): string {
  return `reservation-${bookingRef}.ics`;
}

function downloadIcsOnWeb(input: CalendarInput): void {
  const blob = new Blob([buildIcs(input)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFileName(input.bookingRef);
  a.click();
  URL.revokeObjectURL(url);
}

async function shareIcsOnNative(input: CalendarInput): Promise<void> {
  const file = new File(Paths.cache, icsFileName(input.bookingRef));
  file.create({ overwrite: true });
  file.write(buildIcs(input));
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/calendar",
    UTI: "com.apple.ical.ics",
  });
}

/**
 * Hands the diner their .ics. A browser download on web; on native the file goes to the cache
 * directory and then to the share sheet, which is the only route a phone offers into whatever
 * calendar app the diner actually uses.
 *
 * The cache directory rather than documents on purpose: once the share sheet has handed the
 * event over, the file is spent, and cache is the directory the OS is free to reclaim.
 *
 * @see [calendar.test.ts](../tests/utils/calendar.test.ts) — pins the anchor click on web and
 * the write-then-share on native.
 */
export function deliverIcs(input: CalendarInput): Promise<void> {
  if (Platform.OS === "web") {
    downloadIcsOnWeb(input);
    return Promise.resolve();
  }
  return shareIcsOnNative(input);
}

export function buildCalendarUrls(input: CalendarInput) {
  const { title, description, location, startDate, endDate } = resolveEvent(input);

  // Google Calendar — correct base URL for all platforms
  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmtCal(startDate)}/${fmtCal(endDate)}` +
    `&details=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}`;

  // Outlook web — works on desktop; mobile users should use .ics
  const outlookUrl =
    `https://outlook.live.com/calendar/0/action/compose` +
    `?subject=${encodeURIComponent(title)}` +
    `&startdt=${startDate.toISOString()}` +
    `&enddt=${endDate.toISOString()}` +
    `&body=${encodeURIComponent(description)}` +
    `&location=${encodeURIComponent(location)}`;

  return { googleUrl, outlookUrl, downloadIcs: () => deliverIcs(input) };
}
