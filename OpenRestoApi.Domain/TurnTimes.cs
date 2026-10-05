using System.Text.Json;
using System.Text.Json.Serialization;

namespace OpenRestoApi.Core.Domain;

/// <summary>One stored sitting length: parties of <see cref="MinSeats"/> or more hold their table for <see cref="Minutes"/>.</summary>
public sealed record TurnTime(int MinSeats, int Minutes);

/// <summary>
/// The stored shape of <see cref="Restaurant.TurnTimesJson"/>. Resolving a party's sitting length
/// is <see cref="BookingDuration.For"/>; this class only reads and writes the column.
/// </summary>
public static class TurnTimes
{
    private sealed class Rule
    {
        [JsonPropertyName("minSeats")]
        public int MinSeats { get; set; }

        [JsonPropertyName("minutes")]
        public int Minutes { get; set; }
    }

    /// <summary>The stored rules ordered by party size, or empty when there are none or the JSON is unreadable.</summary>
    public static List<TurnTime> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return (JsonSerializer.Deserialize<List<Rule>>(json) ?? [])
                .Where(r => r != null)
                .Select(r => new TurnTime(r.MinSeats, r.Minutes))
                .OrderBy(r => r.MinSeats)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string Serialize(IEnumerable<TurnTime> rules)
        => JsonSerializer.Serialize(rules
            .OrderBy(r => r.MinSeats)
            .Select(r => new Rule { MinSeats = r.MinSeats, Minutes = r.Minutes }));
}
