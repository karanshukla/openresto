export function fmtCal(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
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

  const title = `Reservation at ${input.restaurantName}`;
  const description = [
    `Booking ref: ${input.bookingRef}`,
    `Guests: ${input.seats}`,
    input.restaurantAddress ? `Address: ${input.restaurantAddress}` : "",
    input.specialRequests ? `Requests: ${input.specialRequests}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const location = input.restaurantAddress;

  const googleUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(title)}&dates=${fmtCal(startDate)}/${fmtCal(endDate)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OpenResto//Booking//EN",
      "BEGIN:VEVENT",
      `DTSTART:${fmtCal(startDate)}`,
      `DTEND:${fmtCal(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      location ? `LOCATION:${location}` : "",
      `UID:${input.bookingRef}@openresto`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservation-${input.bookingRef}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { googleUrl, outlookUrl, downloadIcs };
}
