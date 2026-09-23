using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Tests.TestInfrastructure;

namespace OpenRestoApi.Tests.Services;

public class WaitlistServiceTests
{
    /// <summary>A Saturday evening, inside the 11:00–23:00 UTC hours every test restaurant keeps.</summary>
    private static readonly DateTime Now = new(2026, 9, 26, 19, 0, 0, DateTimeKind.Utc);

    private readonly FakeWaitlistRepository _waitlist = new();
    private readonly Mock<IRestaurantRepository> _restaurants = new();
    private readonly Mock<IBookingRepository> _bookings = new();
    private readonly Mock<IHoldService> _holds = new();
    private readonly Mock<ISystemClock> _clock = new();
    private readonly Mock<IWaitlistReadyNotifier> _notifier = new();
    private readonly Mock<INotificationQueue> _queue = new();
    private readonly Mock<IAuditScope> _audit = new();
    private readonly List<Booking> _inProgress = new();
    private readonly HashSet<int> _bookedTables = new();
    private Restaurant _restaurant = WalkInRestaurant();

    public WaitlistServiceTests()
    {
        _clock.Setup(c => c.UtcNow).Returns(() => Now);
        _restaurants.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(() => _restaurant);
        _bookings.Setup(b => b.GetInProgressForRestaurantAsync(1, It.IsAny<DateTime>(), It.IsAny<int>()))
            .ReturnsAsync(() => _inProgress);
        _bookings.Setup(b => b.IsUnitBookedOnDateAsync(It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<int?>()))
            .ReturnsAsync((int? tableId, int? _, DateTime _, int _, int? _) => tableId is { } id && _bookedTables.Contains(id));
        _bookings.Setup(b => b.AddAsync(It.IsAny<Booking>()))
            .ReturnsAsync((Booking b) => { b.Id = 500; return b; });
    }

    /// <summary>A walk-in-only location with a two-top (id 1) and a four-top (id 2).</summary>
    private static Restaurant WalkInRestaurant(bool walkInOnly = true, string open = "11:00", string close = "23:00")
    {
        var restaurant = new Restaurant
        {
            Id = 1,
            Name = "Door",
            WalkInOnly = walkInOnly,
            OpenTime = open,
            CloseTime = close,
            DefaultBookingDurationMinutes = 60,
        };
        restaurant.Sections.Add(new Section
        {
            Id = 7,
            Name = "Main",
            RestaurantId = 1,
            Tables = new List<Table>
            {
                new() { Id = 1, Seats = 2, SectionId = 7 },
                new() { Id = 2, Seats = 4, SectionId = 7 },
            },
        });
        return restaurant;
    }

    private WaitlistService CreateService(ICurrentUserService? currentUser = null) => new(
        _waitlist,
        _restaurants.Object,
        _bookings.Object,
        new TableAutoAssigner(_bookings.Object, _holds.Object),
        _clock.Object,
        _notifier.Object,
        _queue.Object,
        currentUser,
        _audit.Object);

    private static JoinWaitlistRequest Party(int seats = 2, string name = "Ada", string? email = null, string? locale = null)
        => new() { Name = name, Seats = seats, Email = email, Locale = locale };

    private WaitlistEntry Seed(int seats, WaitlistStatus status = WaitlistStatus.Waiting, int minutesAgo = 10)
    {
        var entry = new WaitlistEntry
        {
            RestaurantId = 1,
            Restaurant = _restaurant,
            Ref = $"ref{_waitlist.Entries.Count + 1}",
            Number = _waitlist.Entries.Count + 1,
            Name = $"Guest {_waitlist.Entries.Count + 1}",
            Seats = seats,
            Status = status,
            CreatedAt = Now.AddMinutes(-minutesAgo),
        };
        _waitlist.Entries.Add(entry);
        entry.Id = _waitlist.Entries.Count;
        return entry;
    }

    // ── Joining ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task JoinAsync_Accepts_DuringAWalkInSitting()
    {
        WaitlistStatusDto status = await CreateService().JoinAsync(1, Party());

        Assert.Equal("waiting", status.Status);
        Assert.Equal(1, status.Number);
        Assert.Equal(0, status.PartiesAhead);
        Assert.Equal(0, status.EstimatedWaitMinutes);
        Assert.Equal(WaitlistFields.RefLength, status.Ref.Length);
        Assert.Equal("Door", status.RestaurantName);
    }

    [Fact]
    public async Task JoinAsync_Rejects_OnADayThatTakesBookings()
    {
        _restaurant = WalkInRestaurant(walkInOnly: false);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService().JoinAsync(1, Party()));
        Assert.Equal(ErrorCodes.WaitlistNotWalkInNow, ex.Code);
    }

    [Fact]
    public async Task JoinAsync_Rejects_OutsideOpeningHours()
    {
        _restaurant = WalkInRestaurant(open: "11:00", close: "15:00");

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService().JoinAsync(1, Party()));
        Assert.Equal(ErrorCodes.WaitlistClosedNow, ex.Code);
    }

    [Fact]
    public async Task JoinAsync_Rejects_APartyNoTableCanSeat()
    {
        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService().JoinAsync(1, Party(seats: 5)));
        Assert.Equal(ErrorCodes.WaitlistPartyTooLarge, ex.Code);
    }

    [Fact]
    public async Task JoinAsync_Rejects_AnUnknownLocation()
    {
        NotFoundException ex = await Assert.ThrowsAsync<NotFoundException>(() => CreateService().JoinAsync(99, Party()));
        Assert.Equal(ErrorCodes.RestaurantNotFound, ex.Code);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task JoinAsync_Rejects_ABlankName(string name)
    {
        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => CreateService().JoinAsync(1, Party(name: name)));
        Assert.Equal(ErrorCodes.WaitlistNameRequired, ex.Code);
    }

    [Fact]
    public async Task JoinAsync_Rejects_AMalformedEmail()
    {
        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(() => CreateService().JoinAsync(1, Party(email: "not-an-address")));
        Assert.Equal(ErrorCodes.WaitlistEmailInvalid, ex.Code);
    }

    [Fact]
    public async Task JoinAsync_TrimsAndLowercasesTheEmail_AndKeepsASupportedLocale()
    {
        await CreateService().JoinAsync(1, Party(name: "  Ada  ", email: " Ada@Example.COM ", locale: "fr"));

        WaitlistEntry stored = Assert.Single(_waitlist.Entries);
        Assert.Equal("Ada", stored.Name);
        Assert.Equal("ada@example.com", stored.Email);
        Assert.Equal("fr", stored.Locale);
    }

    [Fact]
    public async Task JoinAsync_StoresNoEmail_WhenLeftBlank_AndFallsBackToEnglish()
    {
        await CreateService().JoinAsync(1, Party(email: "  ", locale: "xx"));

        WaitlistEntry stored = Assert.Single(_waitlist.Entries);
        Assert.Null(stored.Email);
        Assert.Equal("en", stored.Locale);
    }

    [Fact]
    public async Task JoinAsync_NumbersTickets_FromOneEachLocalDay()
    {
        Seed(2, WaitlistStatus.Seated, minutesAgo: 60 * 20);
        Seed(2, WaitlistStatus.Seated, minutesAgo: 30);

        WaitlistStatusDto status = await CreateService().JoinAsync(1, Party());

        Assert.Equal(2, status.Number);
    }

    // ── Status ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStatusAsync_QuotesTheWaitBehindTheQueueAhead()
    {
        _inProgress.Add(new Booking { TableId = 1, Date = Now.AddMinutes(-40), EndTime = Now.AddMinutes(20) });
        _inProgress.Add(new Booking { TableId = 2, Date = Now.AddMinutes(-15), EndTime = Now.AddMinutes(45) });
        Seed(2, minutesAgo: 20);
        WaitlistEntry mine = Seed(2, minutesAgo: 5);

        WaitlistStatusDto? status = await CreateService().GetStatusAsync(mine.Ref);

        Assert.NotNull(status);
        Assert.Equal(1, status.PartiesAhead);
        Assert.Equal(45, status.EstimatedWaitMinutes);
    }

    [Fact]
    public async Task GetQuoteAsync_QuotesANewPartyBehindTheQueue()
    {
        _inProgress.Add(new Booking { TableId = 1, Date = Now.AddMinutes(-40), EndTime = Now.AddMinutes(20) });
        Seed(2, minutesAgo: 5);

        WaitlistQuoteDto quote = await CreateService().GetQuoteAsync(1, 2);

        Assert.True(quote.AcceptingGuests);
        Assert.Equal(1, quote.PartiesWaiting);
        Assert.Equal(20, quote.EstimatedWaitMinutes);
    }

    [Fact]
    public async Task GetQuoteAsync_HasNoEstimate_ForAPartyNoTableCanSeat()
    {
        WaitlistQuoteDto quote = await CreateService().GetQuoteAsync(1, 9);

        Assert.Null(quote.EstimatedWaitMinutes);
    }

    [Fact]
    public async Task GetStatusAsync_IsNull_ForAnUnknownRef()
    {
        Assert.Null(await CreateService().GetStatusAsync("nope"));
    }

    [Fact]
    public async Task GetStatusAsync_IsNull_OnceTheLocationIsGone()
    {
        WaitlistEntry mine = Seed(2);
        _restaurants.Setup(r => r.GetByIdAsync(1)).ReturnsAsync((Restaurant?)null);

        Assert.Null(await CreateService().GetStatusAsync(mine.Ref));
    }

    [Fact]
    public async Task GetStatusAsync_CarriesNoPlaceInLine_OnceTheEntryHasLeftTheQueue()
    {
        WaitlistEntry mine = Seed(2, WaitlistStatus.Seated);

        WaitlistStatusDto? status = await CreateService().GetStatusAsync(mine.Ref);

        Assert.Equal("seated", status!.Status);
        Assert.Null(status.PartiesAhead);
        Assert.Null(status.EstimatedWaitMinutes);
    }

    // ── Leaving ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task LeaveAsync_ClosesTheEntry()
    {
        WaitlistEntry mine = Seed(2);

        Assert.True(await CreateService().LeaveAsync(mine.Ref));

        Assert.Equal(WaitlistStatus.Left, mine.Status);
        Assert.Equal(Now, mine.ClosedAt);
    }

    [Fact]
    public async Task LeaveAsync_IsIdempotent_AfterTheEntryHasClosed()
    {
        WaitlistEntry mine = Seed(2, WaitlistStatus.Seated);

        Assert.True(await CreateService().LeaveAsync(mine.Ref));

        Assert.Equal(WaitlistStatus.Seated, mine.Status);
    }

    [Fact]
    public async Task LeaveAsync_IsFalse_ForAnUnknownRef()
    {
        Assert.False(await CreateService().LeaveAsync("nope"));
    }

    // ── Board ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBoardAsync_PutsCalledPartiesAheadOfTheQueue()
    {
        WaitlistEntry first = Seed(2, minutesAgo: 30);
        WaitlistEntry called = Seed(4, WaitlistStatus.Notified, minutesAgo: 10);

        WaitlistBoardDto board = await CreateService().GetBoardAsync(1);

        Assert.Equal([called.Id, first.Id], board.Entries.Select(e => e.Id));
        Assert.Equal([0, 1], board.Entries.Select(e => e.PartiesAhead));
        Assert.Equal("notified", board.Entries[0].Status);
    }

    [Fact]
    public async Task GetBoardAsync_FlagsWhoCanBeSeatedNow()
    {
        _bookedTables.Add(2);
        Seed(2);
        Seed(4);

        WaitlistBoardDto board = await CreateService().GetBoardAsync(1);

        Assert.True(board.Entries[0].CanSeatNow);
        Assert.False(board.Entries[1].CanSeatNow);
    }

    [Fact]
    public async Task GetBoardAsync_ReportsWhetherGuestsCanJoin()
    {
        Assert.True((await CreateService().GetBoardAsync(1)).AcceptingGuests);

        _restaurant = WalkInRestaurant(walkInOnly: false);
        Assert.False((await CreateService().GetBoardAsync(1)).AcceptingGuests);
    }

    [Fact]
    public async Task GetBoardAsync_HidesGuestDetails_FromAKeyWithoutGuestsRead()
    {
        WaitlistEntry entry = Seed(2);
        entry.Email = "ada@example.com";

        WaitlistBoardDto board = await CreateService(FakeCurrentUser.ApiKey((ApiKeyScopes.Bookings, ApiKeyScopes.Read))).GetBoardAsync(1);

        Assert.Null(board.Entries[0].Name);
        Assert.Null(board.Entries[0].Email);
    }

    [Fact]
    public async Task AddByStaffAsync_AddsAParty_EvenWhenTheLocationTakesBookings()
    {
        _restaurant = WalkInRestaurant(walkInOnly: false);

        WaitlistEntryDto entry = await CreateService().AddByStaffAsync(1, Party(seats: 4));

        Assert.Equal(4, entry.Seats);
        Assert.Equal("waiting", entry.Status);
        _audit.Verify(a => a.Describe(AuditActions.WaitlistAdd, AuditTargets.WaitlistEntry, It.IsAny<string>(), "#1", 1, It.IsAny<string>()));
    }

    // ── Calling, seating, removing ──────────────────────────────────────────

    [Fact]
    public async Task NotifyAsync_MarksThePartyCalled_AndTellsThem()
    {
        WaitlistEntry entry = Seed(2);

        await CreateService().NotifyAsync(entry.Id);

        Assert.Equal(WaitlistStatus.Notified, entry.Status);
        Assert.Equal(Now, entry.NotifiedAt);
        _notifier.Verify(n => n.NotifyAsync(entry, entry.Restaurant), Times.Once);
        _audit.Verify(a => a.Describe(AuditActions.WaitlistNotify, AuditTargets.WaitlistEntry, It.IsAny<string>(), It.IsAny<string>(), 1, It.IsAny<string>()));
    }

    [Fact]
    public async Task NotifyAsync_Rejects_APartyThatHasLeft()
    {
        WaitlistEntry entry = Seed(2, WaitlistStatus.Left);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => CreateService().NotifyAsync(entry.Id));
        Assert.Equal(ErrorCodes.WaitlistNotActive, ex.Code);
    }

    [Fact]
    public async Task NotifyAsync_Rejects_AnUnknownEntry()
    {
        NotFoundException ex = await Assert.ThrowsAsync<NotFoundException>(() => CreateService().NotifyAsync(42));
        Assert.Equal(ErrorCodes.WaitlistNotFound, ex.Code);
    }

    [Fact]
    public async Task SeatAsync_CreatesABookingOnTheSmallestFreeTable()
    {
        WaitlistEntry entry = Seed(2);
        entry.Email = "ada@example.com";

        SeatWaitlistEntryResponse result = await CreateService().SeatAsync(entry.Id, new SeatWaitlistEntryRequest());

        _bookings.Verify(b => b.AddAsync(It.Is<Booking>(bk =>
            bk.TableId == 1 && bk.SectionId == 7 && bk.Date == Now && bk.EndTime == Now.AddMinutes(60)
            && bk.Seats == 2 && bk.CustomerName == entry.Name && bk.CustomerEmail == "ada@example.com")));
        Assert.Equal(500, result.BookingId);
        Assert.Equal(WaitlistStatus.Seated, entry.Status);
        Assert.Equal(500, entry.BookingId);
        Assert.Equal("seated", result.Entry.Status);
        _queue.Verify(q => q.EnqueueBookingCreated(It.IsAny<Booking>(), "Door"), Times.Once);
    }

    [Fact]
    public async Task SeatAsync_UsesTheChosenTable_WhenItIsFree()
    {
        WaitlistEntry entry = Seed(2);

        await CreateService().SeatAsync(entry.Id, new SeatWaitlistEntryRequest { TableId = 2 });

        _bookings.Verify(b => b.AddAsync(It.Is<Booking>(bk => bk.TableId == 2)));
    }

    [Fact]
    public async Task SeatAsync_Rejects_ATableThatIsNotFree()
    {
        _bookedTables.Add(2);
        WaitlistEntry entry = Seed(2);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => CreateService().SeatAsync(entry.Id, new SeatWaitlistEntryRequest { TableId = 2 }));
        Assert.Equal(ErrorCodes.WaitlistNoTableFree, ex.Code);
    }

    [Fact]
    public async Task SeatAsync_Rejects_WhenNoTableIsFree()
    {
        _bookedTables.UnionWith([1, 2]);
        WaitlistEntry entry = Seed(2);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(
            () => CreateService().SeatAsync(entry.Id, new SeatWaitlistEntryRequest()));
        Assert.Equal(ErrorCodes.WaitlistNoTableFree, ex.Code);
        Assert.Equal(WaitlistStatus.Waiting, entry.Status);
    }

    [Fact]
    public async Task SeatAsync_BooksAGroup_WhenOneIsChosen()
    {
        _restaurant.Groups.Add(new TableGroup
        {
            Id = 9,
            RestaurantId = 1,
            CombinedSeats = 6,
            Members = new List<TableGroupMembership>
            {
                new() { TableGroupId = 9, TableId = 1, Table = _restaurant.Sections.First().Tables.First() },
                new() { TableGroupId = 9, TableId = 2, Table = _restaurant.Sections.First().Tables.Last() },
            },
        });
        WaitlistEntry entry = Seed(6);

        await CreateService().SeatAsync(entry.Id, new SeatWaitlistEntryRequest { TableGroupId = 9 });

        _bookings.Verify(b => b.AddAsync(It.Is<Booking>(bk => bk.TableGroupId == 9 && bk.TableId == null)));
    }

    [Fact]
    public async Task RemoveAsync_ClosesTheEntryAsLeft()
    {
        WaitlistEntry entry = Seed(2, WaitlistStatus.Notified);

        await CreateService().RemoveAsync(entry.Id);

        Assert.Equal(WaitlistStatus.Left, entry.Status);
        _audit.Verify(a => a.Describe(AuditActions.WaitlistRemove, AuditTargets.WaitlistEntry, It.IsAny<string>(), It.IsAny<string>(), 1, It.IsAny<string>()));
    }

    [Fact]
    public async Task SweepAsync_ExpiresEntriesPastStaleAfter_AndDeletesPastRetainFor()
    {
        await CreateService().SweepAsync();

        Assert.Equal(Now.AddHours(-6), _waitlist.ExpiredBefore);
        Assert.Equal(Now.AddDays(-7), _waitlist.DeletedBefore);
    }

    /// <summary>A list-backed repository, so the service's reads see its own writes.</summary>
    private sealed class FakeWaitlistRepository : IWaitlistRepository
    {
        public List<WaitlistEntry> Entries { get; } = new();
        public DateTime? ExpiredBefore { get; private set; }
        public DateTime? DeletedBefore { get; private set; }

        public Task<WaitlistEntry?> GetByIdAsync(int id) => Task.FromResult(Entries.FirstOrDefault(e => e.Id == id));

        public Task<WaitlistEntry?> GetByRefAsync(string entryRef) => Task.FromResult(Entries.FirstOrDefault(e => e.Ref == entryRef));

        public Task<List<WaitlistEntry>> GetActiveForRestaurantAsync(int restaurantId)
            => Task.FromResult(Entries.Where(e => e.RestaurantId == restaurantId && e.IsActive).OrderBy(e => e.CreatedAt).ToList());

        public Task<int> CountCreatedSinceAsync(int restaurantId, DateTime sinceUtc)
            => Task.FromResult(Entries.Count(e => e.RestaurantId == restaurantId && e.CreatedAt >= sinceUtc));

        public Task<WaitlistEntry> AddAsync(WaitlistEntry entry)
        {
            Entries.Add(entry);
            entry.Id = Entries.Count;
            return Task.FromResult(entry);
        }

        public Task SaveChangesAsync() => Task.CompletedTask;

        public Task<int> ExpireActiveCreatedBeforeAsync(DateTime cutoffUtc, DateTime nowUtc)
        {
            ExpiredBefore = cutoffUtc;
            return Task.FromResult(0);
        }

        public Task<int> DeleteCreatedBeforeAsync(DateTime cutoffUtc)
        {
            DeletedBefore = cutoffUtc;
            return Task.FromResult(0);
        }
    }
}
