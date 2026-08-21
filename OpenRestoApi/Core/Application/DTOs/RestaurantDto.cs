using System.ComponentModel.DataAnnotations;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Application.DTOs;

// ── Request types ──────────────────────────────────────────────────────────

public class UpdateRestaurantRequest
{
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string? OpenTime { get; set; }
    public string? CloseTime { get; set; }
    public string? OpenDays { get; set; }

    /// <summary>
    /// Optional freeform blurb shown on the public location detail page. Supports basic
    /// markdown-style inline links. Empty string clears the field; null leaves it untouched.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional link to this location's menu (PDF, page, etc.). Empty string clears the
    /// field; null leaves it untouched.
    /// </summary>
    public string? MenuUrl { get; set; }

    /// <summary>
    /// Optional contact phone number for this location, overriding the global brand phone.
    /// Empty string clears the field; null leaves it untouched.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Optional contact email address for this location, overriding the global brand email.
    /// Empty string clears the field; null leaves it untouched.
    /// </summary>
    public string? EmailAddress { get; set; }

    /// <summary>
    /// Per-day opening hours (ISO day 1=Monday … 7=Sunday). When provided, takes
    /// precedence over OpenTime/CloseTime; identical hours for all 7 days collapse
    /// back into the uniform OpenTime/CloseTime pair.
    /// </summary>
    public List<DayHoursDto>? OpenHours { get; set; }

    public string? Timezone { get; set; }
    public string? Tags { get; set; }
    public int? DefaultBookingDurationMinutes { get; set; }

    /// <summary>
    /// Step, in minutes, between selectable booking start times. Null leaves the stored
    /// value untouched (PATCH-style); validated server-side against the allowed set (15/30/60).
    /// </summary>
    public int? BookingSlotIntervalMinutes { get; set; }

    /// <summary>
    /// Max allowed <c>table.Seats - partySize</c> before a table is considered too large to
    /// offer/book. Null clears the setting (unrestricted). Always assigned from the settings
    /// form so "Off" can be re-saved; validated server-side as non-negative.
    /// </summary>
    public int? MaxTableOversizeSeats { get; set; }

    /// <summary>
    /// Booking reference format for new bookings — "AlphaNumeric" (three words) or "Numeric"
    /// (digits only), case-insensitive. Null leaves the stored value untouched (PATCH-style).
    /// Sent as a string rather than the enum because the API has no string-enum converter
    /// configured, and a bare int would be an opaque contract for the client.
    /// </summary>
    public string? BookingRefFormat { get; set; }

    /// <summary>When true the whole location becomes walk-in only (no online bookings).</summary>
    public bool? WalkInOnly { get; set; }

    /// <summary>Comma-separated ISO days (1=Monday … 7=Sunday) that are walk-in only. Empty string clears.</summary>
    public string? WalkInDays { get; set; }
}

public class PauseRestaurantRequest
{
    public int Minutes { get; set; }
}

public class ExtendRestaurantRequest
{
    public int Minutes { get; set; }
}

public class CreateSectionRequest
{
    public string Name { get; set; } = null!;
}

public class UpdateSectionRequest
{
    public string Name { get; set; } = null!;
}

public class CreateTableRequest
{
    public string? Name { get; set; }

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int Seats { get; set; }
}

public class UpdateTableRequest
{
    public string? Name { get; set; }

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int Seats { get; set; }
}

/// <summary>
/// Best-effort preview of what a table/section delete would orphan — shown in the admin UI's two-step
/// delete confirmation so the owner sees the consequence in concrete terms before destroying the row.
/// <c>Bookings</c> counts non-cancelled <b>future</b> bookings that would lose their table/section
/// reference (the FK-null the delete itself already performs); past/cancelled bookings don't matter.
/// </summary>
public class DeleteImpactDto
{
    /// <summary>Non-cancelled future bookings that lose their table/section reference.</summary>
    public int Bookings { get; set; }
}

// ── Schedule conflicts (#359) ─────────────────────────────────────────────

/// <summary>
/// An upcoming booking that no longer fits the location's current schedule, so the admin who
/// narrowed the hours can see who they have to move or call.
/// </summary>
public class ScheduleConflictDto
{
    public int BookingId { get; set; }
    public string BookingRef { get; set; } = string.Empty;
    public string? CustomerName { get; set; }

    /// <summary>Sitting start, UTC — the client renders it in the location's timezone.</summary>
    public DateTime Date { get; set; }
    public int Seats { get; set; }

    /// <summary>"closedDay" | "outsideHours" | "walkInOnly" — see <c>ScheduleConflictReason</c>.</summary>
    public string Reason { get; set; } = string.Empty;
}

// ── Combinable table groups (#271) ────────────────────────────────────────

public class CreateTableGroupRequest
{
    public string? Name { get; set; }

    /// <summary>Ids of the member tables to combine. Must be &gt;= 2, all owned by the restaurant, none already grouped.</summary>
    public List<int> Members { get; set; } = new();

    /// <summary>Stored combined seating capacity; validated &gt;= sum of member seats and &lt;= <see cref="BookingLimits.MaxSeats"/>.</summary>
    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int CombinedSeats { get; set; }
}

public class UpdateTableGroupRequest
{
    public string? Name { get; set; }
    public List<int> Members { get; set; } = new();

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int CombinedSeats { get; set; }
}

// ── Response DTOs ──────────────────────────────────────────────────────────

public class TableDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public int Seats { get; set; }
}

public class SectionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }
    public List<TableDto> Tables { get; set; } = new();
}

/// <summary>
/// A combinable-table group (#271): physical tables an admin flagged as combinable, bookable as one
/// unit for larger parties. <c>CombinedSeats</c> is the stored capacity; <c>Members</c> are the
/// physical tables pushed together.
/// </summary>
public class TableGroupDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public int CombinedSeats { get; set; }
    public List<TableDto> Members { get; set; } = new();
}

public class ReorderSectionsRequest
{
    /// <summary>
    /// The restaurant's sections, in the desired display order. Must contain exactly the
    /// same set of section IDs the restaurant currently has (no additions/removals here).
    /// </summary>
    public List<int> SectionIds { get; set; } = new();
}

public class DayHoursDto
{
    /// <summary>ISO 8601 day number: 1=Monday … 7=Sunday.</summary>
    public int Day { get; set; }
    public string Open { get; set; } = OpeningHourDefaults.Open;
    public string Close { get; set; } = OpeningHourDefaults.Close;
}

public class RestaurantDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string OpenTime { get; set; } = OpeningHourDefaults.Open;
    public string CloseTime { get; set; } = OpeningHourDefaults.Close;

    /// <summary>Resolved hours for every day of the week (always 7 entries).</summary>
    public List<DayHoursDto> OpenHours { get; set; } = new();

    public string OpenDays { get; set; } = "1,2,3,4,5,6,7";
    public string Timezone { get; set; } = "UTC";
    public string[] Tags { get; set; } = [];
    public string? ImageUrl { get; set; }

    /// <summary>Optional blurb shown on the public location detail page (null when none).</summary>
    public string? Description { get; set; }

    /// <summary>Optional link to this location's menu (null when none).</summary>
    public string? MenuUrl { get; set; }

    /// <summary>Optional contact phone for this location (null when none — callers fall back to the brand phone).</summary>
    public string? PhoneNumber { get; set; }

    /// <summary>Optional contact email for this location (null when none — callers fall back to the brand email).</summary>
    public string? EmailAddress { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>When true the whole location is walk-in only — the booking flow is disabled.</summary>
    public bool WalkInOnly { get; set; }

    /// <summary>Comma-separated ISO days (1=Monday … 7=Sunday) that are walk-in only ("" when none).</summary>
    public string WalkInDays { get; set; } = "";

    public int DefaultBookingDurationMinutes { get; set; } = 60;

    /// <summary>Step (minutes) between selectable booking start times (default 30).</summary>
    public int BookingSlotIntervalMinutes { get; set; } = 30;

    /// <summary>Max allowed spare seats over party size, or null for unrestricted (off).</summary>
    public int? MaxTableOversizeSeats { get; set; }

    /// <summary>Format of references minted for new bookings: "AlphaNumeric" or "Numeric".</summary>
    public string BookingRefFormat { get; set; } = Domain.BookingRefFormat.AlphaNumeric.ToString();

    public List<SectionDto> Sections { get; set; } = new();

    /// <summary>Combinable-table groups defined for this restaurant (#271). Empty when none.</summary>
    public List<TableGroupDto> Groups { get; set; } = new();
}
