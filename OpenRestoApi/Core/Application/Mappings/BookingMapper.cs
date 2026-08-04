using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using Riok.Mapperly.Abstractions;

namespace OpenRestoApi.Core.Application.Mappings;

[Mapper]
public partial class BookingMapper
{
    [MapperIgnoreTarget(nameof(BookingDto.isHeld))]
    [MapperIgnoreTarget(nameof(BookingDto.HoldId))]
    [MapperIgnoreTarget(nameof(BookingDto.MemberTableIds))]
    [MapperIgnoreSource(nameof(Booking.Restaurant))]
    [MapperIgnoreSource(nameof(Booking.TableGroup))]
    [MapProperty("Table.Name", nameof(BookingDto.TableName))]
    [MapProperty("Table.Seats", nameof(BookingDto.TableSeats))]
    [MapProperty("Section.Name", nameof(BookingDto.SectionName))]
    public partial BookingDto ToDto(Booking booking);

    /// <summary>
    /// Maps a booking then fills the display fields for a combinable-table group booking. The base
    /// <see cref="ToDto"/> maps TableName/TableSeats/SectionName from the single Table/Section, which
    /// are null for a group booking (the booking reserves a <see cref="TableGroup"/>). For those rows
    /// we substitute a readable group label, the group's CombinedSeats, and the first member's section
    /// so the diner confirmation, lookup, admin grid, and calendar all show something meaningful
    /// instead of silently dropping the Table/Section rows.
    /// </summary>
    public BookingDto ToDtoWithGroup(Booking booking)
    {
        BookingDto dto = ToDto(booking);
        if (booking.TableGroup is { } group)
        {
            dto.TableGroupId = group.Id;
            // For a group booking Table is null, so the base map left these empty. Substitute a
            // readable group label and the group's combined capacity so display surfaces (diner
            // confirmation, admin grid, email, calendar) show something meaningful. SectionName is
            // already mapped from the persisted SectionId (set to a member's section at create time).
            dto.TableName ??= GroupLabel(group);
            dto.TableSeats ??= group.CombinedSeats;
        }

        return dto;
    }

    /// <summary>A human-readable label for a group: its name, else the member table names joined by " + ".</summary>
    public static string GroupLabel(TableGroup group)
    {
        if (!string.IsNullOrWhiteSpace(group.Name))
        {
            return group.Name;
        }

        var names = group.Members
            .OrderBy(m => m.TableId)
            .Select(m => m.Table?.Name ?? $"Table {m.TableId}")
            .ToList();
        return names.Count > 0 ? $"Tables {string.Join(" + ", names)}" : "Combined tables";
    }

    [MapperIgnoreTarget(nameof(Booking.Table))]
    [MapperIgnoreTarget(nameof(Booking.Section))]
    [MapperIgnoreTarget(nameof(Booking.Restaurant))]
    [MapperIgnoreTarget(nameof(Booking.BookingRef))]
    [MapperIgnoreTarget(nameof(Booking.EndTime))]
    [MapperIgnoreTarget(nameof(Booking.TableGroup))]
    [MapperIgnoreSource(nameof(BookingDto.isHeld))]
    [MapperIgnoreSource(nameof(BookingDto.HoldId))]
    [MapperIgnoreSource(nameof(BookingDto.MemberTableIds))]
    [MapperIgnoreSource(nameof(BookingDto.BookingRef))]
    [MapperIgnoreSource(nameof(BookingDto.EndTime))]
    [MapperIgnoreSource(nameof(BookingDto.TableName))]
    [MapperIgnoreSource(nameof(BookingDto.SectionName))]
    [MapperIgnoreSource(nameof(BookingDto.TableSeats))]
    public partial Booking ToEntity(BookingDto dto);

    public partial IEnumerable<BookingDto> ToDtoList(IEnumerable<Booking> bookings);

    /// <summary>List variant of <see cref="ToDtoWithGroup"/> for the restaurant bookings feed.</summary>
    public IEnumerable<BookingDto> ToDtoWithGroupList(IEnumerable<Booking> bookings)
        => bookings.Select(ToDtoWithGroup).ToList();
}
