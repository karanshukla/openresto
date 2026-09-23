using System.ComponentModel.DataAnnotations;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.DTOs;

public class JoinWaitlistRequest
{
    [Required, StringLength(WaitlistFields.MaxNameLength)]
    public string Name { get; set; } = string.Empty;

    [Range(BookingLimits.MinSeats, BookingLimits.MaxSeats)]
    public int Seats { get; set; }

    /// <summary>Optional. Where the "table ready" email goes.</summary>
    [StringLength(ContactLimits.MaxEmailLength)]
    public string? Email { get; set; }

    [StringLength(GuestPushFields.MaxLocaleLength)]
    public string? Locale { get; set; }
}

/// <summary>What a guest sees about their own place in the queue. Never carries the email.</summary>
public class WaitlistStatusDto
{
    public string Ref { get; set; } = string.Empty;
    public int Number { get; set; }
    public int RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Seats { get; set; }

    /// <summary>"waiting" | "notified" | "seated" | "left" | "expired".</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>Active parties ahead of this one; null once the entry has left the queue.</summary>
    public int? PartiesAhead { get; set; }

    /// <summary>Minutes until a table is expected; 0 when one is free now, null when it can't be estimated.</summary>
    public int? EstimatedWaitMinutes { get; set; }

    public DateTime JoinedAt { get; set; }
    public DateTime? NotifiedAt { get; set; }
}

/// <summary>What a guest sees before joining: whether the queue is open and the wait a new party would face.</summary>
public class WaitlistQuoteDto
{
    public int RestaurantId { get; set; }
    public bool AcceptingGuests { get; set; }
    public int PartiesWaiting { get; set; }

    /// <summary>Minutes a party of the requested size would wait if it joined now; null when no table can seat it.</summary>
    public int? EstimatedWaitMinutes { get; set; }
}

public class WaitlistEntryDto
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public int Seats { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
    public DateTime? NotifiedAt { get; set; }
    public int PartiesAhead { get; set; }
    public int? EstimatedWaitMinutes { get; set; }

    /// <summary>True when a table or group can take the party this minute.</summary>
    public bool CanSeatNow { get; set; }
}

public class WaitlistBoardDto
{
    public int RestaurantId { get; set; }

    /// <summary>Whether guests can join from the public site right now (a walk-in-only, open sitting).</summary>
    public bool AcceptingGuests { get; set; }

    public List<WaitlistEntryDto> Entries { get; set; } = new();
}

/// <summary>Seats a party. With neither id set the smallest free unit that fits is chosen.</summary>
public class SeatWaitlistEntryRequest
{
    public int? TableId { get; set; }
    public int? TableGroupId { get; set; }
}

public class SeatWaitlistEntryResponse
{
    public WaitlistEntryDto Entry { get; set; } = null!;
    public int BookingId { get; set; }
    public string BookingRef { get; set; } = string.Empty;
}
