using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Holds;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

/// <summary>
/// Covers the hold-adoption branches of <c>BookingService.ResolveAutoAssignAsync</c> — in particular
/// adopting an existing combinable-group hold (#272) instead of re-running the candidate search —
/// and the group-capacity guards in <c>CreateGroupBookingAsync</c>.
/// </summary>
public class BookingServiceGroupHoldTests
{
    private sealed class UtcClock : ISystemClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    private static BookingService CreateService(
        AppDbContext db,
        IHoldService holdService,
        IBookingConfirmationService? confirmationService = null,
        INotificationQueue? notificationQueue = null) =>
        new(
            new BookingRepository(db),
            new TableRepository(db),
            new SectionRepository(db),
            new RestaurantRepository(db),
            holdService,
            new BookingMapper(),
            new TableAutoAssigner(new BookingRepository(db), holdService),
            new TableGroupRepository(db),
            confirmationService,
            notificationQueue);

    /// <summary>
    /// One 2-seat standalone table (T1) plus a combinable group of two 4-seat tables (T2, T3)
    /// with CombinedSeats 8 — the same shape the group tests in <see cref="BookingServiceTests"/> use.
    /// </summary>
    private static void SeedRestaurantWithGroup(AppDbContext db)
    {
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Group Bistro", OpenTime = "00:00", CloseTime = "23:59", Timezone = "UTC"
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Name = "T2", Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 3, Name = "T3", Seats = 4, SectionId = 1 });
        db.TableGroups.Add(new TableGroup
        {
            Id = 1, RestaurantId = 1, CombinedSeats = 8,
            Members = new List<TableGroupMembership>
            {
                new() { TableGroupId = 1, TableId = 2 },
                new() { TableGroupId = 1, TableId = 3 }
            }
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_AdoptsGroupFromValidGroupHold()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_AdoptsGroupFromValidGroupHold));
        SeedRestaurantWithGroup(db);
        var holdService = new HoldService(new UtcClock());
        BookingService svc = CreateService(db, holdService);
        DateTime date = DateTime.UtcNow.AddDays(12);

        HoldResult? hold = holdService.PlaceGroupHold(
            restaurantId: 1, tableGroupId: 1, memberTableIds: new[] { 2, 3 }, sectionId: 1, bookingDate: date);
        Assert.NotNull(hold);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "adopted-group@example.com",
            Seats = 6,
            Date = date,
            HoldId = hold!.HoldId
            // No TableId/SectionId/TableGroupId → auto-assign adopts the existing group hold.
        });

        Assert.Equal(1, result.TableGroupId);
        Assert.Null(result.TableId);
        Assert.Equal(1, result.SectionId);

        Booking? persisted = await db.Bookings.FirstOrDefaultAsync(b => b.BookingRef == result.BookingRef);
        Assert.NotNull(persisted);
        Assert.Equal(1, persisted!.TableGroupId);
        Assert.Null(persisted.TableId);

        // The hold is released once the booking lands.
        Assert.Null(holdService.GetHold(hold.HoldId));
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_IgnoresGroupHold_WhenTheGroupWasBookedElsewhere()
    {
        // The held group got booked by someone else between hold and submit. The stale hold must be
        // discarded and the candidate search re-run — here nothing else fits a party of 6, so it conflicts.
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_IgnoresGroupHold_WhenTheGroupWasBookedElsewhere));
        SeedRestaurantWithGroup(db);
        DateTime date = DateTime.UtcNow.AddDays(13);
        db.Bookings.Add(new Booking
        {
            Id = 99, RestaurantId = 1, TableGroupId = 1, SectionId = 1, Date = date,
            BookingRef = "TAKEN", EndTime = date.AddMinutes(60)
        });
        db.SaveChanges();

        var holdService = new HoldService(new UtcClock());
        BookingService svc = CreateService(db, holdService);
        HoldResult? hold = holdService.PlaceGroupHold(1, 1, new[] { 2, 3 }, 1, date);
        Assert.NotNull(hold);

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "stale-group@example.com",
            Seats = 6,
            Date = date,
            HoldId = hold!.HoldId
        }));

        Assert.Contains("No tables are available", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task CreateBookingAsync_AutoAssign_IgnoresHoldBelongingToAnotherRestaurant()
    {
        // A hold placed against a different restaurant must not be adopted — otherwise a caller could
        // reuse a foreign hold id to skip this restaurant's own availability checks.
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_AutoAssign_IgnoresHoldBelongingToAnotherRestaurant));
        SeedRestaurantWithGroup(db);
        var holdService = new HoldService(new UtcClock());
        BookingService svc = CreateService(db, holdService);
        DateTime date = DateTime.UtcNow.AddDays(14);

        HoldResult? foreignHold = holdService.PlaceHold(
            restaurantId: 999, tableId: 2, sectionId: 1, bookingDate: date);
        Assert.NotNull(foreignHold);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "foreign-hold@example.com",
            Seats = 2,
            Date = date,
            HoldId = foreignHold!.HoldId
        });

        // Resolved by a fresh candidate search rather than by adopting the foreign hold: T1 (2 seats)
        // is the smallest fitting table, and T2 is still held by the other restaurant's hold.
        Assert.Equal(1, result.TableId);
        Assert.Equal(1, result.SectionId);
    }

    [Fact]
    public async Task CreateBookingAsync_GroupBooking_RejectsPartyLargerThanCombinedSeats()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GroupBooking_RejectsPartyLargerThanCombinedSeats));
        SeedRestaurantWithGroup(db);
        BookingService svc = CreateService(db, new HoldService(new UtcClock()));

        ConflictException ex = await Assert.ThrowsAsync<ConflictException>(() => svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "too-big@example.com",
            Seats = 9,
            Date = DateTime.UtcNow.AddDays(15),
            TableGroupId = 1
        }));

        Assert.Equal("This group only has 8 combined seats, but 9 guests were requested.", ex.Message);
    }

    [Fact]
    public async Task CreateBookingAsync_GroupBooking_DerivesSectionFromLowestMember_WhenNotSupplied()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GroupBooking_DerivesSectionFromLowestMember_WhenNotSupplied));
        SeedRestaurantWithGroup(db);
        BookingService svc = CreateService(db, new HoldService(new UtcClock()));

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "no-section@example.com",
            Seats = 6,
            Date = DateTime.UtcNow.AddDays(16),
            TableGroupId = 1
            // SectionId omitted — the service resolves it from the lowest-numbered member table.
        });

        Assert.Equal(1, result.SectionId);
        Booking? persisted = await db.Bookings.FirstOrDefaultAsync(b => b.BookingRef == result.BookingRef);
        Assert.Equal(1, persisted!.SectionId);
    }

    [Fact]
    public async Task CreateBookingAsync_GroupBooking_NotifiesAdminsAndEmailsTheGuest()
    {
        // The single-table path enqueues both notifications and sends the confirmation; the group
        // path is a separate method and must not quietly skip either.
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GroupBooking_NotifiesAdminsAndEmailsTheGuest));
        SeedRestaurantWithGroup(db);
        var queue = new Mock<INotificationQueue>();
        var confirmations = new Mock<IBookingConfirmationService>();
        BookingService svc = CreateService(db, new HoldService(new UtcClock()), confirmations.Object, queue.Object);
        DateTime date = DateTime.UtcNow.AddDays(18);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "notified@example.com",
            Seats = 6,
            Date = date,
            TableGroupId = 1
        });

        Assert.Equal(1, result.TableGroupId);
        queue.Verify(q => q.EnqueueBookingCreated(
            It.Is<Booking>(b => b.TableGroupId == 1 && b.TableId == null), "Group Bistro"), Times.Once);
        queue.Verify(q => q.EnqueueCapacityCheck(1, "Group Bistro", It.IsAny<DateTime>()), Times.Once);
        confirmations.Verify(c => c.SendConfirmationAsync(
            It.Is<Booking>(b => b.TableGroupId == 1),
            It.Is<Restaurant>(r => r.Id == 1)), Times.Once);
    }

    [Fact]
    public async Task CreateBookingAsync_GroupBooking_SucceedsWithoutANotificationQueueOrConfirmationService()
    {
        // Both collaborators are optional constructor args; a group booking must still persist when
        // neither is wired up (the shape the unit tests and the seeder use).
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GroupBooking_SucceedsWithoutANotificationQueueOrConfirmationService));
        SeedRestaurantWithGroup(db);
        BookingService svc = CreateService(db, new HoldService(new UtcClock()));

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "quiet@example.com",
            Seats = 6,
            Date = DateTime.UtcNow.AddDays(19),
            TableGroupId = 1
        });

        Assert.Equal(1, result.TableGroupId);
    }

    [Fact]
    public async Task CreateBookingAsync_GroupBooking_SucceedsWhenTheCallersOwnHoldCoversTheMembers()
    {
        // The submitter's own group hold must be excluded from the "held by another user" check,
        // otherwise the hold they were told to send would block their own booking.
        using AppDbContext db = TestDbFactory.Create(nameof(CreateBookingAsync_GroupBooking_SucceedsWhenTheCallersOwnHoldCoversTheMembers));
        SeedRestaurantWithGroup(db);
        var holdService = new HoldService(new UtcClock());
        BookingService svc = CreateService(db, holdService);
        DateTime date = DateTime.UtcNow.AddDays(17);

        HoldResult? hold = holdService.PlaceGroupHold(1, 1, new[] { 2, 3 }, 1, date);
        Assert.NotNull(hold);

        BookingDto result = await svc.CreateBookingAsync(new BookingDto
        {
            RestaurantId = 1,
            CustomerEmail = "own-hold@example.com",
            Seats = 6,
            Date = date,
            TableGroupId = 1,
            SectionId = 1,
            HoldId = hold!.HoldId
        });

        Assert.Equal(1, result.TableGroupId);
        Assert.Null(holdService.GetHold(hold.HoldId));
    }
}
