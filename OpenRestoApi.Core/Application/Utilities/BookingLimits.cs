namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Centralized bounds for seat/party-size and table-capacity values, so the DTO annotations,
/// service guards, and frontend dropdowns all agree on a single source of truth.
/// </summary>
public static class BookingLimits
{
    /// <summary>
    /// Smallest allowed value for a booking party size or a table/group seating capacity.
    /// A booking must reserve at least one seat; a table must seat at least one guest.
    /// </summary>
    public const int MinSeats = 1;

    /// <summary>
    /// Largest allowed party size (and per-table/group capacity). Mirrors the diner-facing seat
    /// picker's hard cap so a direct API POST can't bypass it. Parties larger than this should be
    /// handled by the restaurant directly (the diner UI shows a "contact us" notice past the
    /// location's effective capacity, which is always &lt;= this ceiling).
    /// </summary>
    public const int MaxSeats = 50;
}
