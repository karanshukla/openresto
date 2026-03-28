using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using Riok.Mapperly.Abstractions;

namespace OpenRestoApi.Core.Application.Mappings;

[Mapper]
public partial class BookingMapper
{
    [MapperIgnoreTarget(nameof(BookingDto.isHeld))]
    [MapperIgnoreTarget(nameof(BookingDto.HoldId))]
    [MapperIgnoreSource(nameof(Booking.Restaurant))]
    [MapperIgnoreSource(nameof(Booking.IsCancelled))]
    [MapperIgnoreSource(nameof(Booking.CancelledAt))]
    [MapProperty("Table.Name", nameof(BookingDto.TableName))]
    [MapProperty("Table.Seats", nameof(BookingDto.TableSeats))]
    [MapProperty("Section.Name", nameof(BookingDto.SectionName))]
    public partial BookingDto ToDto(Booking booking);

    [MapperIgnoreTarget(nameof(Booking.Table))]
    [MapperIgnoreTarget(nameof(Booking.Section))]
    [MapperIgnoreTarget(nameof(Booking.Restaurant))]
    [MapperIgnoreTarget(nameof(Booking.BookingRef))]
    [MapperIgnoreTarget(nameof(Booking.EndTime))]
    [MapperIgnoreTarget(nameof(Booking.IsCancelled))]
    [MapperIgnoreTarget(nameof(Booking.CancelledAt))]
    [MapperIgnoreSource(nameof(BookingDto.isHeld))]
    [MapperIgnoreSource(nameof(BookingDto.HoldId))]
    [MapperIgnoreSource(nameof(BookingDto.BookingRef))]
    [MapperIgnoreSource(nameof(BookingDto.EndTime))]
    [MapperIgnoreSource(nameof(BookingDto.TableName))]
    [MapperIgnoreSource(nameof(BookingDto.SectionName))]
    [MapperIgnoreSource(nameof(BookingDto.TableSeats))]
    public partial Booking ToEntity(BookingDto dto);

    public partial IEnumerable<BookingDto> ToDtoList(IEnumerable<Booking> bookings);
}
