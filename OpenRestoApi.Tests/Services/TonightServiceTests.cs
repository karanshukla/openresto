using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Services;

public class TonightServiceTests
{
    /// <summary>A Thursday evening, local and UTC alike.</summary>
    private static readonly DateTime Now = new(2026, 11, 5, 19, 0, 0, DateTimeKind.Utc);

    private readonly Mock<IRestaurantRepository> _restaurants = new();
    private readonly Mock<IBookingRepository> _bookings = new();
    private readonly Mock<IWaitlistRepository> _waitlist = new();
    private readonly Mock<ISystemClock> _clock = new();
    private readonly List<Booking> _loaded = [];
    private readonly List<WaitlistEntry> _queue = [];
    private readonly Restaurant _restaurant;

    public TonightServiceTests()
    {
        _restaurant = new Restaurant
        {
            Id = 1,
            Name = "Flagship",
            Timezone = "UTC",
            OpenTime = "11:00",
            CloseTime = "23:00",
            DefaultBookingDurationMinutes = 60,
        };
        var two = new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 7 };
        var four = new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 7 };
        var six = new Table { Id = 3, Name = "T3", Seats = 6, SectionId = 7, WalkInOnly = true };
        _restaurant.Sections.Add(new Section { Id = 7, Name = "Main", RestaurantId = 1, Tables = [two, four, six] });
        var group = new TableGroup { Id = 9, RestaurantId = 1, CombinedSeats = 6 };
        group.Members.Add(new TableGroupMembership { TableGroupId = 9, TableId = 1, Table = two });
        group.Members.Add(new TableGroupMembership { TableGroupId = 9, TableId = 2, Table = four });
        _restaurant.Groups.Add(group);

        _clock.Setup(c => c.UtcNow).Returns(Now);
        _restaurants.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(() => _restaurant);
        _bookings.Setup(b => b.GetForRestaurantInUtcRangeAsync(1, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync((int _, DateTime from, DateTime to) => _loaded.Where(b => b.Date >= from && b.Date < to).ToList());
        _bookings.Setup(b => b.GetInProgressForRestaurantAsync(1, It.IsAny<DateTime>(), It.IsAny<int>())).ReturnsAsync([]);
        _waitlist.Setup(w => w.GetActiveForRestaurantAsync(1)).ReturnsAsync(() => _queue);
    }

    private TonightService CreateService(ICurrentUserService? currentUser = null)
    {
        var holds = new Mock<IHoldService>();
        var admin = new AdminService(
            _bookings.Object,
            new Mock<IBookingFilterRepository>().Object,
            _restaurants.Object,
            new Mock<ISectionRepository>().Object,
            new Mock<ITableRepository>().Object,
            holds.Object,
            new Mock<IEmailService>().Object,
            null,
            null,
            null,
            currentUser);
        var waitlist = new WaitlistService(
            _waitlist.Object,
            _restaurants.Object,
            _bookings.Object,
            new TableAutoAssigner(_bookings.Object, holds.Object),
            _clock.Object,
            currentUser: currentUser);
        return new TonightService(_restaurants.Object, _bookings.Object, admin, waitlist,
            new TableAutoAssigner(_bookings.Object, holds.Object), _clock.Object);
    }

    private Booking Seed(int id, int minutesFromNow, BookingStatus status = BookingStatus.Booked,
        int? tableId = null, int? groupId = null, int length = 60)
    {
        var booking = new Booking
        {
            Id = id,
            RestaurantId = 1,
            Restaurant = _restaurant,
            SectionId = 7,
            TableId = tableId,
            TableGroupId = groupId,
            Date = Now.AddMinutes(minutesFromNow),
            EndTime = Now.AddMinutes(minutesFromNow + length),
            Seats = 2,
            BookingRef = $"REF{id}",
            CustomerName = $"Guest {id}",
            CustomerEmail = $"guest{id}@example.com",
            Status = status,
        };
        _loaded.Add(booking);
        return booking;
    }

    private static FloorUnitDto Table(TonightDto dto, int id) => dto.Sections.SelectMany(s => s.Units).Single(u => u.Id == id);

    [Fact]
    public async Task GetAsync_DerivesEachTilesState()
    {
        Seed(1, -30, BookingStatus.Seated, tableId: 1);
        Seed(2, 20, tableId: 2);
        Seed(3, -90, BookingStatus.Seated, tableId: 3, length: 80);

        TonightDto dto = await CreateService().GetAsync(1);

        Assert.Equal("seated", Table(dto, 1).State);
        Assert.Equal(1, Table(dto, 1).CurrentBookingId);
        Assert.Equal(Now.AddMinutes(30), Table(dto, 1).CurrentEndsAt);
        Assert.Equal("bookedSoon", Table(dto, 2).State);
        Assert.Equal(2, Table(dto, 2).NextBookingId);
        Assert.Equal("overdue", Table(dto, 3).State);
        Assert.True(Table(dto, 3).WalkInOnly);
        Assert.Equal(30, dto.BookedSoonMinutes);
        Assert.Equal(Now, dto.Now);
    }

    [Fact]
    public async Task GetAsync_MarksAMemberTableSeated_WhenItsGroupIsSeated()
    {
        Seed(1, -10, BookingStatus.Seated, groupId: 9);

        TonightDto dto = await CreateService().GetAsync(1);

        Assert.Equal("seated", dto.Groups.Single().State);
        Assert.Equal("seated", Table(dto, 1).State);
        Assert.Equal("seated", Table(dto, 2).State);
        Assert.Equal("free", Table(dto, 3).State);
    }

    [Fact]
    public async Task GetAsync_MarksAGroupSeated_WhenAMemberTableIsSeated()
    {
        Seed(1, -10, BookingStatus.Seated, tableId: 2);

        TonightDto dto = await CreateService().GetAsync(1);

        FloorUnitDto group = dto.Groups.Single();
        Assert.Equal("seated", group.State);
        Assert.Equal([1, 2], group.MemberTableIds);
        Assert.Equal("group", group.Kind);
        Assert.Equal("free", Table(dto, 1).State);
    }

    [Fact]
    public async Task GetAsync_ListsTonightsBookingsInStartOrder_AndLeavesYesterdaysOut()
    {
        Seed(1, 120);
        Seed(2, 30);
        Seed(3, -60 * 24);

        TonightDto dto = await CreateService().GetAsync(1);

        Assert.Equal([2, 1], dto.Bookings.Select(b => b.Id));
    }

    [Fact]
    public async Task GetAsync_KeepsASittingFromBeforeMidnightOnTheFloor()
    {
        _clock.Setup(c => c.UtcNow).Returns(new DateTime(2026, 11, 6, 0, 30, 0, DateTimeKind.Utc));
        // Both sat down at 23:00 the evening before; only one has finished.
        Booking seated = Seed(1, 240, BookingStatus.Seated, tableId: 1, length: 150);
        Booking finished = Seed(2, 240, BookingStatus.Finished, tableId: 2);

        TonightDto dto = await CreateService().GetAsync(1);

        Assert.Equal([seated.Id], dto.Bookings.Select(b => b.Id));
        Assert.Equal("seated", Table(dto, 1).State);
        Assert.Equal("free", Table(dto, 2).State);
        Assert.NotEqual(finished.Id, Table(dto, 2).CurrentBookingId);
    }

    [Fact]
    public async Task GetAsync_CarriesTheWaitlistBoard()
    {
        _queue.Add(new WaitlistEntry
        {
            Id = 4, RestaurantId = 1, Restaurant = _restaurant, Ref = "r", Number = 1,
            Name = "Ada", Email = "ada@example.com", Seats = 2, Status = WaitlistStatus.Waiting, CreatedAt = Now.AddMinutes(-5),
        });

        TonightDto dto = await CreateService().GetAsync(1);

        WaitlistEntryDto entry = Assert.Single(dto.Waitlist.Entries);
        Assert.Equal("Ada", entry.Name);
        Assert.True(entry.CanSeatNow);
    }

    [Fact]
    public async Task GetAsync_OffersAWaitingPartyOnlyTheUnitsFreeForAWholeSitting()
    {
        // The two-top is free now but booked in 30 minutes, inside a 60-minute sitting; the
        // four-top is free all evening.
        _bookings.Setup(b => b.IsUnitBookedOnDateAsync(It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<int?>()))
            .ReturnsAsync((int? tableId, int? groupId, DateTime _, int _, int? _) => tableId == 1 || groupId == 9);
        _queue.Add(new WaitlistEntry
        {
            Id = 4, RestaurantId = 1, Restaurant = _restaurant, Ref = "r", Number = 1,
            Name = "Ada", Seats = 2, Status = WaitlistStatus.Waiting, CreatedAt = Now.AddMinutes(-5),
        });

        TonightDto dto = await CreateService().GetAsync(1);

        SeatableNowDto seatable = Assert.Single(dto.SeatableNow);
        Assert.Equal(2, seatable.Seats);
        Assert.DoesNotContain(1, seatable.TableIds);
        Assert.Contains(2, seatable.TableIds);
        Assert.Empty(seatable.TableGroupIds);
    }

    [Fact]
    public async Task GetAsync_ListsNoSeatableUnits_WithNobodyWaiting()
    {
        TonightDto dto = await CreateService().GetAsync(1);

        Assert.Empty(dto.SeatableNow);
    }

    [Fact]
    public async Task GetAsync_RedactsGuests_ForAKeyWithoutGuestsRead()
    {
        Seed(1, 15, tableId: 1);
        _queue.Add(new WaitlistEntry
        {
            Id = 4, RestaurantId = 1, Restaurant = _restaurant, Ref = "r", Number = 1,
            Name = "Ada", Email = "ada@example.com", Seats = 2, Status = WaitlistStatus.Waiting, CreatedAt = Now.AddMinutes(-5),
        });

        TonightDto dto = await CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read))).GetAsync(1);

        BookingDetailDto booking = Assert.Single(dto.Bookings);
        Assert.Null(booking.CustomerName);
        Assert.Null(booking.CustomerEmail);
        WaitlistEntryDto entry = Assert.Single(dto.Waitlist.Entries);
        Assert.Null(entry.Name);
        Assert.Null(entry.Email);
    }

    [Fact]
    public async Task GetAsync_KeepsGuests_ForAKeyWithGuestsRead()
    {
        Seed(1, 15, tableId: 1);

        TonightDto dto = await CreateService(FakeCurrentUser.ApiKey(
            (ApiKeyScopes.Bookings, ApiKeyScopes.Read), (ApiKeyScopes.Guests, ApiKeyScopes.Read))).GetAsync(1);

        Assert.Equal("Guest 1", Assert.Single(dto.Bookings).CustomerName);
    }

    [Fact]
    public async Task GetAsync_Throws_ForAnUnknownLocation()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => CreateService().GetAsync(99));
    }
}
