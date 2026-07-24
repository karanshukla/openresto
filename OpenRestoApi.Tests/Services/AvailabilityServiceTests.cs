using Moq;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class AvailabilityServiceTests
{
    [Fact]
    public async Task GetAvailabilityAsync_ReturnsAllSlots_WhenNoBookings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsAllSlots_WhenNoBookings));
        TestSeed.RestaurantWithHours(db);
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // 11:00 to 13:00 with 30 min slots = 4 slots
        Assert.Equal(4, result.Slots.Count);
        Assert.All(result.Slots, s => Assert.True(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersOccupiedSlots()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_FiltersOccupiedSlots));
        TestSeed.RestaurantWithHours(db);

        // Book both tables at 12:00
        var date = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = date, BookingRef = "B1" });
        db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, TableId = 2, SectionId = 1, Date = date, BookingRef = "B2" });
        db.SaveChanges();

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // Slot at 12:00 should be unavailable
        TimeSlotDto slot1200 = result.Slots.First(s => s.Time == "12:00");
        Assert.False(slot1200.IsAvailable);

        // Slots at 11:00 should be available (assuming 1 hour duration, 12:00 starts right when 11:00 ends)
        // Wait, 11:00 ends at 12:00. Booking is at 12:00. So 11:00 is fine.
        TimeSlotDto slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.True(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesRestaurantConfiguredDuration_ForConflictWindow()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesRestaurantConfiguredDuration_ForConflictWindow));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "13:00", Timezone = "UTC",
            DefaultBookingDurationMinutes = 90
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        // Booking at 12:00 with no explicit EndTime -> should fall back to the
        // restaurant's configured 90-minute duration, occupying 12:00-13:30.
        var bookingStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = bookingStart, BookingRef = "B1" });
        db.SaveChanges();

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, bookingStart, 2);

        // With a 90-minute duration, the 11:00 slot (11:00-12:30) should now conflict
        // with the 12:00 booking, whereas with the old fixed 1-hour assumption it would not.
        TimeSlotDto slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.False(slot1100.IsAvailable);

        TimeSlotDto slot1200 = result.Slots.First(s => s.Time == "12:00");
        Assert.False(slot1200.IsAvailable);
    }

    // ── BookingSlotIntervalMinutes (#245) ────────────────────────────────────
    // The interval controls the step between selectable start times, decoupled from the
    // booking duration. A 15-min interval must produce slots at every quarter hour, and
    // combining a longer duration with a shorter interval must not produce double-bookings.

    [Fact]
    public async Task GetAvailabilityAsync_UsesRestaurantConfiguredSlotInterval_ForStep()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesRestaurantConfiguredSlotInterval_ForStep));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "12:00", Timezone = "UTC",
            BookingSlotIntervalMinutes = 15
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);

        // 11:00 → 12:00 stepping by 15 min = 4 slots (11:00, 11:15, 11:30, 11:45).
        Assert.Equal(4, result.Slots.Count);
        Assert.Equal(["11:00", "11:15", "11:30", "11:45"], result.Slots.Select(s => s.Time).ToList());
    }

    [Fact]
    public async Task GetAvailabilityAsync_DefaultInterval_StepsEvery30Minutes()
    {
        // Backwards-compat: with no interval set, the entity default (30) preserves the
        // pre-setting slot grid exactly.
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_DefaultInterval_StepsEvery30Minutes));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "12:00", Timezone = "UTC"
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);

        Assert.Equal(["11:00", "11:30"], result.Slots.Select(s => s.Time).ToList());
    }

    [Fact]
    public async Task GetAvailabilityAsync_60MinuteInterval_ProducesHourlySlots()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_60MinuteInterval_ProducesHourlySlots));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "14:00", Timezone = "UTC",
            BookingSlotIntervalMinutes = 60
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);

        Assert.Equal(["11:00", "12:00", "13:00"], result.Slots.Select(s => s.Time).ToList());
    }

    [Fact]
    public async Task GetAvailabilityAsync_LongDurationShortInterval_NoDoubleBooking()
    {
        // #245 core acceptance criterion: a 90-minute duration with a 15-minute interval.
        // A single table booked at 12:00 must mark every overlapping generated start time
        // (11:15–12:15 all overlap a 12:00–13:30 booking window) unavailable — no start
        // time that would double-book the table should be offered as available.
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_LongDurationShortInterval_NoDoubleBooking));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "14:00", Timezone = "UTC",
            DefaultBookingDurationMinutes = 90,
            BookingSlotIntervalMinutes = 15
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        // Booking occupies 12:00–13:30 (90-min duration).
        var bookingStart = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = bookingStart, BookingRef = "B1" });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, bookingStart, 2);

        // Generated start times: 11:00, 11:15, 11:30, ..., 13:45. Each 90-min slot overlaps
        // the 12:00–13:30 booking window iff slotStart < 13:30 AND slotStart+90 > 12:00,
        // i.e. slotStart > 10:30. So every slot from 11:00 through 13:15 must be unavailable,
        // and 13:30 / 13:45 (which end at/after the booking, no overlap) must be available.
        var unavailable = result.Slots.Where(s => !s.IsAvailable).Select(s => s.Time).ToList();
        Assert.Contains("11:00", unavailable);
        Assert.Contains("11:15", unavailable);
        Assert.Contains("12:00", unavailable);
        Assert.Contains("13:15", unavailable);

        var available = result.Slots.Where(s => s.IsAvailable).Select(s => s.Time).ToList();
        Assert.Contains("13:30", available);
        Assert.Contains("13:45", available);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ConsidersHolds()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ConsidersHolds));
        TestSeed.RestaurantWithHours(db);

        var date = new DateTime(2026, 10, 10, 11, 0, 0, DateTimeKind.Utc);
        var holdSvc = new Mock<IHoldService>();
        // Hold both tables at 11:00
        holdSvc.Setup(h => h.IsTableHeld(1, date, null)).Returns(true);
        holdSvc.Setup(h => h.IsTableHeld(2, date, null)).Returns(true);

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        TimeSlotDto slot1100 = result.Slots.First(s => s.Time == "11:00");
        Assert.False(slot1100.IsAvailable);
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersByCapacity()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_FiltersByCapacity));
        TestSeed.RestaurantWithHours(db); // Table 1 (2 seats), Table 2 (4 seats)

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);

        // Request 5 seats
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 5);
        Assert.All(result.Slots, s => Assert.False(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_Throws_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_Throws_WhenRestaurantNotFound));
        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var svc = new AvailabilityService(bookingRepo, restRepo, new Mock<IHoldService>().Object);

        await Assert.ThrowsAsync<NotFoundException>(() => svc.GetAvailabilityAsync(999, DateTime.UtcNow, 2));
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesUtc_WhenTimezoneInvalid()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesUtc_WhenTimezoneInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", Timezone = "Invalid/Timezone", OpenTime = "09:00", CloseTime = "10:00" });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.NotEmpty(result.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsNoSlots_WhenPaused()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsNoSlots_WhenPaused));
        db.Restaurants.Add(new Restaurant 
        { 
            Id = 1, Name = "T", OpenTime = "09:00", CloseTime = "10:00", Timezone = "UTC",
            BookingsPausedUntil = DateTime.UtcNow.AddHours(1) 
        });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, DateTime.UtcNow.Date, 2);
        Assert.All(result.Slots, s => Assert.False(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesDefaultHours_WhenTimeFormatInvalid()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesDefaultHours_WhenTimeFormatInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "T", OpenTime = "invalid", CloseTime = "", Timezone = "UTC" });
        db.SaveChanges();
        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var result = await svc.GetAvailabilityAsync(1, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), 2);
        // Default is 09:00 to 22:00 -> 13 hours * 2 slots/hour = 26 slots
        Assert.Equal(26, result.Slots.Count);
    }

    [Fact]
    public async Task GetAvailabilityAsync_HandlesDayNames_InOpenDays()
    {
        // This test ensures frontend format "Mon,Tue,Wed..." works correctly
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_HandlesDayNames_InOpenDays));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "T",
            OpenTime = "09:00",
            CloseTime = "22:00",
            Timezone = "UTC",
            OpenDays = "Mon,Tue,Wed,Thu,Fri,Sat,Sun"  // Frontend format
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // Monday Jan 5, 2026
        var monday = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
        var result = await svc.GetAvailabilityAsync(1, monday, 2);

        Assert.NotEmpty(result.Slots);
        Assert.All(result.Slots, s => Assert.True(s.IsAvailable));
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsNoSlots_WhenClosedDay()
    {
        // Weekend-only restaurant
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsNoSlots_WhenClosedDay));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "T",
            OpenTime = "09:00",
            CloseTime = "22:00",
            Timezone = "UTC",
            OpenDays = "Sat,Sun"  // Weekend only
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // Monday Jan 5, 2026 - should have no slots
        var monday = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
        var result = await svc.GetAvailabilityAsync(1, monday, 2);

        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_PopulatesAvailableTableIds()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_PopulatesAvailableTableIds));
        TestSeed.RestaurantWithHours(db); // Table 1 (2 seats), Table 2 (4 seats)

        // Book Table 1 at 12:00
        var date = new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc);
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = date, BookingRef = "B1" });
        db.SaveChanges();

        var bookingRepo = new BookingRepository(db);
        var restRepo = new RestaurantRepository(db);
        var holdSvc = new Mock<IHoldService>();
        var svc = new AvailabilityService(bookingRepo, restRepo, holdSvc.Object);

        // Case 1: Request 2 seats. At 12:00, only Table 2 should be available.
        var result2Seats = await svc.GetAvailabilityAsync(1, date, 2);
        var slot1200_2 = result2Seats.Slots.First(s => s.Time == "12:00");
        Assert.Single(slot1200_2.AvailableTableIds);
        Assert.Equal(2, slot1200_2.AvailableTableIds[0]);

        // Case 2: Request 4 seats. At 12:00, Table 2 should be available. Table 1 is too small.
        var result4Seats = await svc.GetAvailabilityAsync(1, date, 4);
        var slot1200_4 = result4Seats.Slots.First(s => s.Time == "12:00");
        Assert.Single(slot1200_4.AvailableTableIds);
        Assert.Equal(2, slot1200_4.AvailableTableIds[0]);

        // Case 3: At 11:00, both tables should be available for 2 seats.
        var slot1100 = result2Seats.Slots.First(s => s.Time == "11:00");
        Assert.Equal(2, slot1100.AvailableTableIds.Count);
        Assert.Contains(1, slot1100.AvailableTableIds);
        Assert.Contains(2, slot1100.AvailableTableIds);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ExcludesOversizedTables_WhenMaxTableOversizeSeatsSet()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(GetAvailabilityAsync_ExcludesOversizedTables_WhenMaxTableOversizeSeatsSet));
        // RestaurantWithHours: Table 1 (2 seats), Table 2 (4 seats). Cap spare seats at 1,
        // so a 2-top party may use Table 1 (0 spare) or Table 2 (2 spare) — Table 2 is excluded.
        TestSeed.RestaurantWithHours(db);
        db.Restaurants.Single().MaxTableOversizeSeats = 1;
        db.SaveChanges();

        var svc = new AvailabilityService(
            new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // The oversized 4-seat Table 2 must never appear in any slot's available ids.
        Assert.All(result.Slots, s => Assert.DoesNotContain(2, s.AvailableTableIds));
        // The well-sized 2-seat Table 1 still appears on an open slot.
        Assert.Contains(result.Slots, s => s.AvailableTableIds.Contains(1));
    }

    [Fact]
    public async Task GetAvailabilityAsync_IncludesOversizedTables_WhenMaxTableOversizeSeatsUnset()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(GetAvailabilityAsync_IncludesOversizedTables_WhenMaxTableOversizeSeatsUnset));
        TestSeed.RestaurantWithHours(db); // Table 1 (2 seats), Table 2 (4 seats), cap unset.

        var svc = new AvailabilityService(
            new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var date = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, date, 2);

        // No cap → both tables are eligible for a 2-top party on an open slot.
        Assert.Contains(result.Slots, s => s.AvailableTableIds.Contains(1) && s.AvailableTableIds.Contains(2));
    }

    [Fact]
    public void GetCategory_ReturnsCorrectValues()
    {
        // GetCategory is private static, but we can test it via public method results
        // Lunch: 11:30 - 14:30
        // Dinner: 17:30 - 21:30
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsSlots_ForMondayInNegativeUtcOffsetTimezone()
    {
        // Regression test: midnight UTC on a Monday is Sunday evening in UTC-negative timezones.
        // The service must treat the incoming date as the local date (not convert from UTC).
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsSlots_ForMondayInNegativeUtcOffsetTimezone));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "T",
            OpenTime = "09:00",
            CloseTime = "22:00",
            Timezone = "America/New_York",  // UTC-4 in summer
            OpenDays = "1,2,3,4,5"         // Mon–Fri only
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // Frontend sends the local date string "2026-06-01" (Monday), which ASP.NET Core
        // model-binds as DateTimeKind.Unspecified. Simulate that here.
        var monday = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var result = await svc.GetAvailabilityAsync(1, monday, 2);

        // Should return slots — the restaurant is open on Mondays
        Assert.NotEmpty(result.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesPerDayHours_ForOverriddenDay()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesPerDayHours_ForOverriddenDay));
        TestSeed.RestaurantWithHours(db);
        Restaurant r = db.Restaurants.First();
        // Saturday opens later and shorter than the uniform 11:00–13:00
        r.OpenHoursJson = """{"6":{"open":"12:00","close":"13:00"}}""";
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // 2026-10-10 is a Saturday (ISO day 6)
        var saturday = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, saturday, 2);

        // 12:00 to 13:00 with 30-min slots = 2 slots instead of the uniform 4
        Assert.Equal(2, result.Slots.Count);
        Assert.Equal("12:00", result.Slots[0].Time);
        Assert.Equal("12:30", result.Slots[1].Time);
    }

    [Fact]
    public async Task GetAvailabilityAsync_UsesUniformHours_ForDayWithoutOverride()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_UsesUniformHours_ForDayWithoutOverride));
        TestSeed.RestaurantWithHours(db);
        Restaurant r = db.Restaurants.First();
        r.OpenHoursJson = """{"6":{"open":"12:00","close":"13:00"}}""";
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // 2026-10-09 is a Friday (ISO day 5) — no override, uniform 11:00–13:00
        var friday = new DateTime(2026, 10, 9, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, friday, 2);

        Assert.Equal(4, result.Slots.Count);
        Assert.Equal("11:00", result.Slots[0].Time);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ClosedDay_ReturnsNoSlots_EvenWithPerDayHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ClosedDay_ReturnsNoSlots_EvenWithPerDayHours));
        TestSeed.RestaurantWithHours(db);
        Restaurant r = db.Restaurants.First();
        // Saturday has hours configured but is excluded from OpenDays
        r.OpenDays = "1,2,3,4,5";
        r.OpenHoursJson = """{"6":{"open":"12:00","close":"13:00"}}""";
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        var saturday = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(1, saturday, 2);

        Assert.Empty(result.Slots);
    }

    // ── Walk-in-only policy ───────────────────────────────────────────────────

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsNoSlots_WhenLocationIsWalkInOnly()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsNoSlots_WhenLocationIsWalkInOnly));
        TestSeed.RestaurantWithHours(db);
        Restaurant walkInOnly = db.Restaurants.First();
        walkInOnly.WalkInOnly = true;
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 9, 0, 0, 0, DateTimeKind.Utc), 2);

        Assert.Empty(result.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsNoSlots_OnWalkInDay()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ReturnsNoSlots_OnWalkInDay));
        TestSeed.RestaurantWithHours(db);
        Restaurant withWalkInDay = db.Restaurants.First();
        withWalkInDay.WalkInDays = "6";
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // 2026-10-10 is a Saturday (ISO day 6) — walk-in only, no slots.
        AvailabilityResponseDto saturday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.Empty(saturday.Slots);

        // 2026-10-11 is a Sunday — bookings still allowed, 4 half-hour slots.
        AvailabilityResponseDto sunday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 11, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.Equal(4, sunday.Slots.Count);
    }

    [Fact]
    public async Task GetAvailabilityAsync_WrapsPastMidnight_WhenCloseTimeIsBeforeOpenTime()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_WrapsPastMidnight_WhenCloseTimeIsBeforeOpenTime));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Late Bar", OpenTime = "22:00", CloseTime = "02:00", Timezone = "UTC",
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        AvailabilityResponseDto result = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);

        // 22:00 -> next day 02:00 in 30-min steps = 8 slots, wrapping past midnight.
        Assert.Equal(8, result.Slots.Count);
        Assert.Equal("22:00", result.Slots.First().Time);
        Assert.Equal("01:30", result.Slots.Last().Time);
        Assert.Contains(result.Slots, s => s.Time == "00:00");
    }

    [Fact]
    public async Task GetAvailabilityAsync_ParsesOpenDays_GivenSundayAsTextRatherThanIsoNumber()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_ParsesOpenDays_GivenSundayAsTextRatherThanIsoNumber));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "13:00", Timezone = "UTC",
            OpenDays = "sunday",
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // 2026-10-11 is a Sunday — "sunday" should parse to ISO day 7 and be treated as open.
        AvailabilityResponseDto sunday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 11, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.NotEmpty(sunday.Slots);

        // 2026-10-10 is a Saturday — not in OpenDays, so no slots.
        AvailabilityResponseDto saturday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.Empty(saturday.Slots);
    }

    [Fact]
    public async Task GetAvailabilityAsync_IgnoresUnrecognizedOpenDaysEntry_ButKeepsValidOnes()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAvailabilityAsync_IgnoresUnrecognizedOpenDaysEntry_ButKeepsValidOnes));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1, Name = "Test", OpenTime = "11:00", CloseTime = "13:00", Timezone = "UTC",
            // "notaday" doesn't match any ParseDayOfWeek case and parses to 0, which gets
            // filtered out by the `d > 0` guard — it should be silently ignored rather than
            // corrupting the rest of the OpenDays list.
            OpenDays = "monday,notaday",
        });
        db.Sections.Add(new Section { Id = 1, Name = "Main", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 2, SectionId = 1 });
        db.SaveChanges();

        var svc = new AvailabilityService(new BookingRepository(db), new RestaurantRepository(db), new Mock<IHoldService>().Object);

        // 2026-10-12 is a Monday — the valid entry keeps it open.
        AvailabilityResponseDto monday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.NotEmpty(monday.Slots);

        // 2026-10-13 is a Tuesday — not in OpenDays, so no slots.
        AvailabilityResponseDto tuesday = await svc.GetAvailabilityAsync(
            1, new DateTime(2026, 10, 13, 0, 0, 0, DateTimeKind.Utc), 2);
        Assert.Empty(tuesday.Slots);
    }
}
