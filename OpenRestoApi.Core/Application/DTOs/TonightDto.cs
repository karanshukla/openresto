namespace OpenRestoApi.Core.Application.DTOs;

/// <summary>
/// Everything the host stand polls in one read: the floor, tonight's bookings and the waitlist.
/// </summary>
public class TonightDto
{
    public int RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string Timezone { get; set; } = "UTC";

    /// <summary>The server's clock, so the tablet's countdowns agree with the states it was sent.</summary>
    public DateTime Now { get; set; }

    /// <summary>How far ahead a booking marks a table booked soon.</summary>
    public int BookedSoonMinutes { get; set; }

    public List<FloorSectionDto> Sections { get; set; } = [];

    /// <summary>Combinable groups, apart from the sections because a group can span them.</summary>
    public List<FloorUnitDto> Groups { get; set; } = [];

    /// <summary>
    /// Tonight's non-cancelled bookings in start order, plus any earlier sitting still on the floor,
    /// so every booking a tile points at is here.
    /// </summary>
    public List<BookingDetailDto> Bookings { get; set; } = [];

    public WaitlistBoardDto Waitlist { get; set; } = new();

    /// <summary>
    /// For each party size on the waitlist, the units free for a whole sitting from now: the
    /// same candidates seating picks from, so the floor never offers a tile the seat would refuse.
    /// </summary>
    public List<SeatableNowDto> SeatableNow { get; set; } = [];
}

public class SeatableNowDto
{
    public int Seats { get; set; }
    public List<int> TableIds { get; set; } = [];
    public List<int> TableGroupIds { get; set; } = [];
}

public class FloorSectionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<FloorUnitDto> Units { get; set; } = [];
}

public class FloorUnitDto
{
    /// <summary>"table" or "group".</summary>
    public string Kind { get; set; } = "table";

    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Seats { get; set; }
    public bool WalkInOnly { get; set; }

    /// <summary>For a group, the tables pushed together; empty for a table.</summary>
    public List<int> MemberTableIds { get; set; } = [];

    /// <summary>"free" | "bookedSoon" | "seated" | "overdue".</summary>
    public string State { get; set; } = "free";

    /// <summary>The seated booking, when the unit is seated or overdue.</summary>
    public int? CurrentBookingId { get; set; }

    /// <summary>When the seated party's sitting ends (past it when overdue).</summary>
    public DateTime? CurrentEndsAt { get; set; }

    /// <summary>The next booking still to sit down here tonight, whatever the state.</summary>
    public int? NextBookingId { get; set; }

    public DateTime? NextBookingAt { get; set; }
}
