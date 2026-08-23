using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// What the admin timetable needs off a booking to draw it on the floor: which unit it reserves
/// (a table or a combinable group) and when the sitting actually ends.
/// </summary>
public partial class AdminServiceTests
{
    private void SeedGroup(int restaurantId, int groupId, string? name = null)
    {
        _db.Tables.Add(new Table { Id = 80 + groupId, Name = "T8", Seats = 4, SectionId = restaurantId });
        _db.Tables.Add(new Table { Id = 90 + groupId, Name = "T9", Seats = 4, SectionId = restaurantId });
        _db.TableGroups.Add(new TableGroup
        {
            Id = groupId,
            Name = name,
            RestaurantId = restaurantId,
            CombinedSeats = 7,
            Members =
            [
                new TableGroupMembership { TableGroupId = groupId, TableId = 80 + groupId },
                new TableGroupMembership { TableGroupId = groupId, TableId = 90 + groupId },
            ],
        });
    }

    [Fact]
    public async Task GetBookingsAsync_ExposesTableGroupId_SoAGroupBookingCanBePlaced()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        SeedGroup(restaurantId: 1, groupId: 5, name: "Window booths");
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = null,
            TableGroupId = 5,
            Seats = 7,
            Date = DateTime.UtcNow.Date.AddHours(19),
            BookingRef = "GROUP",
        });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> bookings = await svc.GetBookingsAsync(1, null, "all");

        BookingDetailDto dto = Assert.Single(bookings);
        Assert.Null(dto.TableId);
        Assert.Equal(5, dto.TableGroupId);
        Assert.Equal("Window booths", dto.TableName);
    }

    [Fact]
    public async Task GetBookingsAsync_LabelsAnUnnamedGroupFromItsMemberTables()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        SeedGroup(restaurantId: 1, groupId: 6);
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableGroupId = 6,
            Seats = 7,
            Date = DateTime.UtcNow.Date.AddHours(19),
            BookingRef = "GROUP",
        });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> bookings = await svc.GetBookingsAsync(1, null, "all");

        Assert.Equal("Tables T8 + T9", Assert.Single(bookings).TableName);
    }

    [Fact]
    public async Task GetBookingsAsync_KeepsTableIdAndLeavesGroupNull_ForASingleTableBooking()
    {
        AdminService svc = CreateService();
        SeedBase(1);
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Seats = 2,
            Date = DateTime.UtcNow.Date.AddHours(19),
            BookingRef = "SINGLE",
        });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> bookings = await svc.GetBookingsAsync(1, null, "all");

        BookingDetailDto dto = Assert.Single(bookings);
        Assert.Equal(1, dto.TableId);
        Assert.Null(dto.TableGroupId);
    }

    [Fact]
    public async Task GetBookingsAsync_ResolvesAStoredlessEndTimeToTheLocationsDefaultDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "Test",
            Timezone = "UTC",
            DefaultBookingDurationMinutes = 105,
        });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime start = DateTime.UtcNow.Date.AddHours(19);
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Seats = 2,
            Date = start,
            EndTime = null,
            BookingRef = "LEGACY",
        });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> bookings = await svc.GetBookingsAsync(1, null, "all");

        Assert.Equal(start.AddMinutes(105), Assert.Single(bookings).EndTime);
    }

    [Fact]
    public async Task GetBookingsAsync_KeepsAStoredEndTimeRatherThanTheDefaultDuration()
    {
        AdminService svc = CreateService();
        _db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "Test",
            Timezone = "UTC",
            DefaultBookingDurationMinutes = 105,
        });
        _db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        _db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        DateTime start = DateTime.UtcNow.Date.AddHours(19);
        _db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            SectionId = 1,
            TableId = 1,
            Seats = 2,
            Date = start,
            EndTime = start.AddMinutes(180),
            BookingRef = "EXTENDED",
        });
        await _db.SaveChangesAsync();

        List<BookingDetailDto> bookings = await svc.GetBookingsAsync(1, null, "all");

        Assert.Equal(start.AddMinutes(180), Assert.Single(bookings).EndTime);
    }
}
