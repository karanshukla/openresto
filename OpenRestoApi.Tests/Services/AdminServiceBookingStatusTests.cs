using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public partial class AdminServiceTests
{
    private AdminService CreateService(IAuditScope audit)
        => new(
            new BookingRepository(_db),
            new BookingFilterRepository(_db),
            new RestaurantRepository(_db),
            new SectionRepository(_db),
            new TableRepository(_db),
            _holdServiceMock.Object,
            _emailServiceMock.Object,
            brandService: null,
            notificationQueue: null,
            audit: audit,
            currentUser: null);

    private async Task<Booking> SeedSittingAsync(
        int id = 1, int startedMinutesAgo = 30, int lengthMinutes = 90,
        string? email = "ada@example.com", BookingStatus status = BookingStatus.Booked)
    {
        if (!_db.Restaurants.Any())
        {
            SeedBase(1);
        }

        DateTime start = DateTime.UtcNow.AddMinutes(-startedMinutesAgo);
        var booking = new Booking
        {
            Id = id, RestaurantId = 1, SectionId = 1, TableId = 1, Seats = 2,
            Date = start, EndTime = start.AddMinutes(lengthMinutes),
            CustomerName = "Ada Lovelace", CustomerEmail = email, BookingRef = $"ref-{id}",
            Status = status,
        };
        _db.Bookings.Add(booking);
        await _db.SaveChangesAsync();
        return booking;
    }

    [Fact]
    public async Task SetBookingStatusAsync_FinishingEarly_FreesTheTable()
    {
        await SeedSittingAsync(status: BookingStatus.Seated);
        var bookings = new BookingRepository(_db);
        var assigner = new TableAutoAssigner(bookings, _holdServiceMock.Object);
        Restaurant restaurant = (await new RestaurantRepository(_db).GetByIdAsync(1))!;
        Assert.Empty(await assigner.BuildCandidatesAsync(restaurant, 2, DateTime.UtcNow.AddMinutes(1)));

        await CreateService().SetBookingStatusAsync(1, "Finished");

        DateTime soon = DateTime.UtcNow.AddMinutes(1);
        Assert.False(await bookings.IsUnitBookedOnDateAsync(1, null, soon, 60));
        Assert.Contains(await assigner.BuildCandidatesAsync(restaurant, 2, soon), c => c.TableId == 1);
    }

    [Fact]
    public async Task SetBookingStatusAsync_RefusesANoShow_BeforeTheSittingStarts()
    {
        await SeedSittingAsync(startedMinutesAgo: -(Booking.CancellationGraceMinutes + 5));

        BusinessRuleException ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => CreateService().SetBookingStatusAsync(1, "NoShow"));

        Assert.Equal(ErrorCodes.BookingNoShowBeforeStart, ex.Code);
    }

    [Fact]
    public async Task SetBookingStatusAsync_MarksANoShow_OnceTheSittingHasStarted()
    {
        await SeedSittingAsync(startedMinutesAgo: 10);

        BookingDetailDto? result = await CreateService().SetBookingStatusAsync(1, "noshow");

        Assert.Equal("NoShow", result!.Status);
        Assert.True(result.EndTime <= DateTime.UtcNow);
    }

    [Fact]
    public async Task SetBookingStatusAsync_Refuses_ACancelledBooking()
    {
        Booking booking = await SeedSittingAsync();
        booking.IsCancelled = true;
        await _db.SaveChangesAsync();

        BusinessRuleException ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => CreateService().SetBookingStatusAsync(1, "Arrived"));

        Assert.Equal(ErrorCodes.BookingStatusCancelled, ex.Code);
    }

    [Fact]
    public async Task SetBookingStatusAsync_Refuses_ABackwardMoveThatIsNotAnUndo()
    {
        await SeedSittingAsync(status: BookingStatus.Seated);

        BusinessRuleException ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => CreateService().SetBookingStatusAsync(1, "Arrived"));

        Assert.Equal(ErrorCodes.BookingStatusTransitionInvalid, ex.Code);
    }

    [Fact]
    public async Task SetBookingStatusAsync_Rejects_AnUnknownStatus()
    {
        await SeedSittingAsync();

        ValidationException ex = await Assert.ThrowsAsync<ValidationException>(
            () => CreateService().SetBookingStatusAsync(1, "2"));

        Assert.Equal(ErrorCodes.BookingStatusInvalid, ex.Code);
    }

    [Fact]
    public async Task SetBookingStatusAsync_Undo_RestoresTheOriginalEndTime()
    {
        Booking booking = await SeedSittingAsync(status: BookingStatus.Seated);
        DateTime originalEnd = booking.EndTime!.Value;
        AdminService svc = CreateService();

        BookingDetailDto? finished = await svc.SetBookingStatusAsync(1, "Finished");
        Assert.Equal("Seated", finished!.UndoStatus);

        BookingDetailDto? undone = await svc.SetBookingStatusAsync(1, "Seated");

        Assert.Equal("Seated", undone!.Status);
        Assert.Equal(originalEnd, undone.EndTime!.Value, TimeSpan.FromSeconds(1));
        Assert.Null(undone.UndoStatus);
    }

    [Fact]
    public async Task SetBookingStatusAsync_RecordsFromAndTo_WithoutTheGuestsName()
    {
        await SeedSittingAsync();
        var audit = new AuditScope();

        await CreateService(audit).SetBookingStatusAsync(1, "Arrived");

        Assert.Equal(AuditActions.BookingStatus, audit.Action);
        Assert.Contains("\"status\"", audit.ChangesJson());
        Assert.Contains("Booked", audit.ChangesJson());
        Assert.Contains("Arrived", audit.ChangesJson());
        Assert.DoesNotContain("Ada", audit.Summary);
        Assert.DoesNotContain("Ada", audit.TargetLabel);
    }

    [Fact]
    public async Task GetBookingAsync_CountsTheGuestsOtherNoShows_CaseInsensitively()
    {
        await SeedSittingAsync(id: 1, startedMinutesAgo: 60 * 24 * 7, status: BookingStatus.NoShow);
        await SeedSittingAsync(id: 2, startedMinutesAgo: 60 * 24 * 3, email: "ADA@example.com ", status: BookingStatus.NoShow);
        await SeedSittingAsync(id: 3, startedMinutesAgo: 60 * 24 * 2, email: "someone@else.example", status: BookingStatus.NoShow);
        await SeedSittingAsync(id: 4, startedMinutesAgo: -60);

        BookingDetailDto? upcoming = await CreateService().GetBookingAsync(4);
        BookingDetailDto? noShow = await CreateService().GetBookingAsync(1);

        Assert.Equal(2, upcoming!.PreviousNoShows);
        Assert.Equal(1, noShow!.PreviousNoShows);
    }

    [Fact]
    public async Task GetBookingsAsync_ListsAFinishedSittingAsPast_InsideTheGridGrace()
    {
        await SeedSittingAsync(id: 1, startedMinutesAgo: 30, status: BookingStatus.Finished);
        await SeedSittingAsync(id: 2, startedMinutesAgo: 30);
        AdminService svc = CreateService();

        List<BookingDetailDto> past = await svc.GetBookingsAsync(1, null, "past");
        List<BookingDetailDto> active = await svc.GetBookingsAsync(1, null, "active");

        Assert.Equal([1], past.Select(b => b.Id));
        Assert.Equal([2], active.Select(b => b.Id));
    }

    [Fact]
    public async Task GetBookingsAsync_FiltersToNoShows()
    {
        await SeedSittingAsync(id: 1, status: BookingStatus.NoShow);
        await SeedSittingAsync(id: 2, startedMinutesAgo: 200);

        List<BookingDetailDto> noShows = await CreateService().GetBookingsAsync(1, null, "noshow");

        Assert.Equal([1], noShows.Select(b => b.Id));
    }

    [Fact]
    public async Task GetOverviewAsync_CountsTodaysNoShows()
    {
        await SeedSittingAsync(id: 1, startedMinutesAgo: 0, status: BookingStatus.NoShow);
        await SeedSittingAsync(id: 2, startedMinutesAgo: 0, email: "b@example.com");

        AdminOverviewDto overview = await CreateService().GetOverviewAsync();

        Assert.Equal(1, overview.TodayNoShowsCount);
    }
}
