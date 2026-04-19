export function fmtCal(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/** RFC 5545 line folding: max 75 octets per line, continuation with CRLF + space */
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
  if (chunk) result += (result === "" ? "" : "\r\n ") + chunk;
  return result;
}

/** Escape special characters in iCal text fields */
function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

interface CalendarInput {
  bookingRef: string;
  date: string;
  seats: number;
  specialRequests?: string;
  restaurantName: string;
  restaurantAddress: string;
}

export function buildCalendarUrls(input: CalendarInput) {
  const startDate = new Date(input.date);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const now = new Date();

  const title = `Reservation at ${input.restaurantName}`;

  const origin = typeof window !== "undefined" ? window.location?.origin : "";
  const descriptionLines = [
    origin ? `Booked via the URL: (${origin})` : "",
    `Booking reference: ${input.bookingRef}`,
    `Guests: ${input.seats}`,
    input.restaurantAddress ? `Address: ${input.restaurantAddress}` : "",
    input.specialRequests ? `Requests: ${input.specialRequests}` : "",
  ].filter(Boolean);

  const descriptionPlain = descriptionLines.join("\n");
  const location = input.restaurantAddress;

  // Google Calendar — correct base URL for all platforms
  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmtCal(startDate)}/${fmtCal(endDate)}` +
    `&details=${encodeURIComponent(descriptionPlain)}` +
    `&location=${encodeURIComponent(location)}`;

  // Outlook web — works on desktop; mobile users should use .ics
  const outlookUrl =
    `https://outlook.live.com/calendar/0/action/compose` +
    `?subject=${encodeURIComponent(title)}` +
    `&startdt=${startDate.toISOString()}` +
    `&enddt=${endDate.toISOString()}` +
    `&body=${encodeURIComponent(descriptionPlain)}` +
    `&location=${encodeURIComponent(location)}`;

  // .ics — works for Apple Calendar, Outlook mobile, and any other calendar app
  const downloadIcs = () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "PRODID:-//OpenResto//Booking//EN",
      "BEGIN:VEVENT",
      `DTSTAMP:${fmtCal(now)}`,
      `DTSTART:${fmtCal(startDate)}`,
      `DTEND:${fmtCal(endDate)}`,
      `SUMMARY:${escapeIcal(title)}`,
      `DESCRIPTION:${escapeIcal(descriptionPlain)}`,
      ...(location ? [`LOCATION:${escapeIcal(location)}`] : []),
      `UID:${input.bookingRef}@openresto`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n");

    const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservation-${input.bookingRef}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { googleUrl, outlookUrl, downloadIcs };
}
