using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Core.Application.DTOs;

// ── Auth ─────────────────────────────────────────────────────────────────────

public class LoginRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

// ── Overview / Stats ─────────────────────────────────────────────────────────

public class AdminOverviewDto
{
    public int TotalRestaurants { get; set; }
    public int TotalBookings { get; set; }
    public int TodayBookings { get; set; }
    public int TotalSeats { get; set; }
    public int ActiveHoldsCount { get; set; }
    public int PausedRestaurantsCount { get; set; }

    /// <summary>
    /// Upcoming bookings across every active location that its current schedule would no longer
    /// accept. The locations screen reports these per location, but an admin who narrows hours
    /// and navigates away never sees that panel again.
    /// </summary>
    public int ScheduleConflictsCount { get; set; }

    /// <summary>
    /// The locations those conflicts belong to. The count alone names no location, so a control
    /// built on it can only drop the admin on whichever location the screen happened to remember.
    /// </summary>
    public List<int> ScheduleConflictLocationIds { get; set; } = [];
    public List<int> OccupancyData { get; set; } = [];
    public List<string> OccupancyDates { get; set; } = [];
    public List<int> OccupancyCounts { get; set; } = [];
    public List<BookingDetailDto> TodayBookingsList { get; set; } = [];
}

// ── Booking detail (admin view — includes resolved names) ────────────────────

public class BookingDetailDto
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public string? RestaurantName { get; set; }

    /// <summary>
    /// The location's IANA timezone. <see cref="Date"/> is UTC, so it names no wall-clock time on
    /// its own — anything shown to or sent to a guest has to resolve it through this rather than
    /// through whatever zone the admin's browser happens to be in.
    /// </summary>
    public string? Timezone { get; set; }
    public int? SectionId { get; set; }
    public string? SectionName { get; set; }
    public int? TableId { get; set; }

    /// <summary>
    /// Set when the booking reserves a combinable <c>TableGroup</c> rather than a single table, in
    /// which case <see cref="TableId"/> is null. Both are never set at once, so a consumer placing a
    /// booking on the floor has to branch on this or it will silently drop every group booking.
    /// </summary>
    public int? TableGroupId { get; set; }

    public string? TableName { get; set; }
    public DateTime Date { get; set; }

    /// <summary>
    /// The sitting's end, resolved through <c>BookingDuration.ResolveEnd</c> — a booking stored with
    /// no end reads as its location's default duration rather than as zero-length.
    /// </summary>
    public DateTime? EndTime { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    public int Seats { get; set; }
    public string? SpecialRequests { get; set; }
    public string? BookingRef { get; set; }
    public bool IsCancelled { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public class ExtendBookingRequest
{
    /// <summary>Additional minutes to add to the booking's EndTime.</summary>
    public int Minutes { get; set; }
}

// ── Send email to booking guest ──────────────────────────────────────────────

public class SendBookingEmailRequest
{
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
}

// ── Admin booking create (walk-in — no hold required) ────────────────────────

public class AdminCreateBookingRequest
{
    public int RestaurantId { get; set; }
    public int SectionId { get; set; }
    public int TableId { get; set; }
    public DateTime Date { get; set; }
    public string CustomerEmail { get; set; } = null!;
    public string? CustomerName { get; set; }

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int Seats { get; set; }
}

// ── Admin booking update (PUT — can modify all fields) ───────────────────────

public class AdminUpdateBookingRequest
{
    public int? RestaurantId { get; set; }
    public int? SectionId { get; set; }
    public int? TableId { get; set; }
    public DateTime? Date { get; set; }

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int? Seats { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerName { get; set; }
    public string? SpecialRequests { get; set; }
}

// ── Admin restaurant create ───────────────────────────────────────────────────

public class CreateRestaurantRequest
{
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
}

// ── PVQ (Personal Verification Questions) ────────────────────────────────────

public class SetupPvqRequest
{
    public string Question { get; set; } = null!;
    public string Answer { get; set; } = null!;
}

public class VerifyPvqRequest
{
    public string Email { get; set; } = null!;
    public string Answer { get; set; } = null!;
}

public class ResetPasswordRequest
{
    public string ResetToken { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}

public class ChangeEmailRequest
{
    public string CurrentPassword { get; set; } = null!;
    public string NewEmail { get; set; } = null!;
}

public class LookupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTime? BookingsPausedUntil { get; set; }
    public int ActiveBookingsCount { get; set; }
    /// <summary>Non-cancelled bookings that have not started yet — what archiving takes off the public site.</summary>
    public int UpcomingBookingsCount { get; set; }
    public bool IsArchived { get; set; }
}

/// <summary>
/// Blast radius of <c>DELETE /api/admin/restaurants/{id}</c>, so the confirmation names what
/// the cascade destroys instead of describing it in the abstract.
/// </summary>
public class RestaurantDeletePreviewDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsArchived { get; set; }
    public int SectionCount { get; set; }
    public int TableCount { get; set; }
    public int TableGroupCount { get; set; }
    public int BookingCount { get; set; }
    public int UpcomingBookingCount { get; set; }
}

public class AdminRestaurantPatchRequest
{
    public bool? IsArchived { get; set; }
}

public class MessageResponse
{
    public string Message { get; set; } = null!;

    /// <summary>
    /// Stable machine-readable identifier for the rule behind <see cref="Message"/> (see
    /// <see cref="ErrorCodes"/>). Additive: omitted from the JSON entirely when null, so existing
    /// response snapshots that only ever saw "message" do not shift.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Code { get; set; }

    /// <summary>
    /// Values <see cref="Message"/> interpolated, keyed by placeholder name, so a client
    /// rendering its own copy for <see cref="Code"/> can rebuild the same sentence in its own
    /// language. Additive and omitted when null, like <see cref="Code"/>.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyDictionary<string, object>? Args { get; set; }
}

public class PvqStatusDto
{
    public bool IsConfigured { get; set; }
    public string? Question { get; set; }
}
