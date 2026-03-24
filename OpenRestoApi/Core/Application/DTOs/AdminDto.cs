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
}

// ── Booking detail (admin view — includes resolved names) ────────────────────

public class BookingDetailDto
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public string? RestaurantName { get; set; }
    public int SectionId { get; set; }
    public string? SectionName { get; set; }
    public int TableId { get; set; }
    public string? TableName { get; set; }
    public DateTime Date { get; set; }
    public DateTime? EndTime { get; set; }
    public string? CustomerEmail { get; set; }
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
    public int Seats { get; set; }
}

// ── Admin booking update (PATCH — all fields optional) ───────────────────────

public class UpdateBookingRequest
{
    public DateTime? Date { get; set; }
    public int? Seats { get; set; }
    public int? TableId { get; set; }
    public int? SectionId { get; set; }
    public string? CustomerEmail { get; set; }
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

public class PvqStatusDto
{
    public bool IsConfigured { get; set; }
    public string? Question { get; set; }
}
