using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Services;

public class RestaurantManagementServiceTests
{
    private static AppDbContext CreateDb(string name)
    {
        DbContextOptions<AppDbContext> opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new AppDbContext(opts);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAll()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ReturnsAll));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.GetByIdAsync(999));
    }

    [Fact]
    public async Task CreateAsync_HandlesNestedEntities()
    {
        using AppDbContext db = CreateDb(nameof(CreateAsync_HandlesNestedEntities));
        var svc = new RestaurantManagementService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            Sections = [new SectionDto { Name = "S1", Tables = [new TableDto { Name = "T1", Seats = 4 }] }]
        };
        RestaurantDto result = await svc.CreateAsync(dto);
        Assert.Single(result.Sections);
        Assert.Single(result.Sections[0].Tables);
    }

    [Fact]
    public async Task CreateAsync_AssignsSequentialSortOrder_ToBulkCreatedSections()
    {
        // Regression test (#178 review): CreateAsync previously omitted SortOrder from the
        // bulk section-creation mapping, so every section created through this path defaulted
        // to SortOrder = 0 instead of reflecting the order the caller supplied them in.
        using AppDbContext db = CreateDb(nameof(CreateAsync_AssignsSequentialSortOrder_ToBulkCreatedSections));
        var svc = new RestaurantManagementService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            Sections =
            [
                new SectionDto { Name = "First", Tables = [] },
                new SectionDto { Name = "Second", Tables = [] },
                new SectionDto { Name = "Third", Tables = [] },
            ]
        };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal([0, 1, 2], result.Sections.Select(s => s.SortOrder));
    }

    [Fact]
    public async Task CreateAsync_CopiesDefaultBookingDurationMinutes_FromDto()
    {
        // Regression test (#135 review): CreateAsync previously omitted
        // DefaultBookingDurationMinutes from the field-by-field entity mapping, silently
        // discarding any caller-supplied value and always persisting the entity default (60).
        using AppDbContext db = CreateDb(nameof(CreateAsync_CopiesDefaultBookingDurationMinutes_FromDto));
        var svc = new RestaurantManagementService(db);
        var dto = new RestaurantDto { Name = "New", DefaultBookingDurationMinutes = 90 };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal(90, result.DefaultBookingDurationMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.Equal(90, entity!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateAsync(999, new UpdateRestaurantRequest()));
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_UpdatesFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "New",
            OpenTime = "09:00",
            CloseTime = "22:00",
            OpenDays = "1,2,3",
            Timezone = "GMT"
        });
        Assert.Equal("New", result!.Name);
        Assert.Equal("GMT", result.Timezone);
    }

    // ── Per-day opening hours (#175) ─────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_StoresPerDayHours_AndReturnsResolvedWeek()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_StoresPerDayHours_AndReturnsResolvedWeek));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", OpenTime = "09:00", CloseTime = "22:00", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        var hours = Enumerable.Range(1, 7)
            .Select(d => new DayHoursDto { Day = d, Open = "10:00", Close = "20:00" })
            .ToList();
        hours[6] = new DayHoursDto { Day = 7, Open = "12:00", Close = "16:00" }; // Sunday differs

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", OpenHours = hours });

        Assert.NotNull(result);
        Assert.Equal(7, result!.OpenHours.Count);
        Assert.Equal("12:00", result.OpenHours.Single(h => h.Day == 7).Open);
        Assert.Equal("10:00", result.OpenHours.Single(h => h.Day == 1).Open);
        Assert.NotNull(db.Restaurants.Single(r => r.Id == 1).OpenHoursJson);
    }

    [Fact]
    public async Task UpdateAsync_CollapsesUniformPerDayHours_IntoOpenCloseTime()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_CollapsesUniformPerDayHours_IntoOpenCloseTime));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "R",
            OpenTime = "09:00",
            CloseTime = "22:00",
            Timezone = "UTC",
            OpenHoursJson = """{"6":{"open":"11:00","close":"23:00"}}"""
        });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        var uniform = Enumerable.Range(1, 7)
            .Select(d => new DayHoursDto { Day = d, Open = "08:00", Close = "18:00" })
            .ToList();

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", OpenHours = uniform });

        Restaurant saved = db.Restaurants.Single(r => r.Id == 1);
        Assert.Null(saved.OpenHoursJson);
        Assert.Equal("08:00", saved.OpenTime);
        Assert.Equal("18:00", saved.CloseTime);
        Assert.All(result!.OpenHours, h =>
        {
            Assert.Equal("08:00", h.Open);
            Assert.Equal("18:00", h.Close);
        });
    }

    [Fact]
    public async Task UpdateAsync_Throws_WhenOpenHoursInvalid()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_Throws_WhenOpenHoursInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        var invalid = new List<DayHoursDto> { new() { Day = 9, Open = "10:00", Close = "20:00" } };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", OpenHours = invalid }));
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsResolvedOpenHours()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsResolvedOpenHours));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "R",
            OpenTime = "09:00",
            CloseTime = "22:00",
            Timezone = "UTC",
            OpenHoursJson = """{"6":{"open":"11:00","close":"23:00"}}"""
        });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        RestaurantDto? dto = await svc.GetByIdAsync(1);

        Assert.NotNull(dto);
        Assert.Equal(7, dto!.OpenHours.Count);
        Assert.Equal("11:00", dto.OpenHours.Single(h => h.Day == 6).Open);
        Assert.Equal("09:00", dto.OpenHours.Single(h => h.Day == 1).Open);
    }

    // ── DefaultBookingDurationMinutes (#135) ─────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_ReturnsDefaultBookingDurationMinutes()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsDefaultBookingDurationMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", DefaultBookingDurationMinutes = 90 });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);
        Assert.Equal(90, result!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task RestaurantDto_DefaultsBookingDurationTo60()
    {
        var dto = new RestaurantDto();
        Assert.Equal(60, dto.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesDefaultBookingDurationMinutes()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_UpdatesDefaultBookingDurationMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = 120 });

        Assert.Equal(120, result!.DefaultBookingDurationMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(1);
        Assert.Equal(120, entity!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_KeepsExistingDuration_WhenNotProvided()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_KeepsExistingDuration_WhenNotProvided));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", DefaultBookingDurationMinutes = 90 });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R" });

        Assert.Equal(90, result!.DefaultBookingDurationMinutes);
    }

    [Theory]
    [InlineData(45)]
    [InlineData(0)]
    [InlineData(-30)]
    [InlineData(500)]
    public async Task UpdateAsync_Throws_WhenDurationNotInAllowedSet(int invalidDuration)
    {
        using AppDbContext db = CreateDb($"{nameof(UpdateAsync_Throws_WhenDurationNotInAllowedSet)}_{invalidDuration}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = invalidDuration }));
    }

    [Theory]
    [InlineData(30)]
    [InlineData(60)]
    [InlineData(90)]
    [InlineData(480)]
    public async Task UpdateAsync_Accepts_WhenDurationInAllowedSet(int validDuration)
    {
        using AppDbContext db = CreateDb($"{nameof(UpdateAsync_Accepts_WhenDurationInAllowedSet)}_{validDuration}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = validDuration });

        Assert.Equal(validDuration, result!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_ReturnsNull_WhenRestaurantNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddSectionAsync(999, "S1"));
    }

    [Fact]
    public async Task UpdateSectionAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateSectionAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateSectionAsync(1, 1, "New"));
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteSectionAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteSectionAsync(1, 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsNull_WhenSectionNotFound()
    {
        using AppDbContext db = CreateDb(nameof(AddTableAsync_ReturnsNull_WhenSectionNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.AddTableAsync(1, 1, "T1", 4));
    }

    [Fact]
    public async Task UpdateTableAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateTableAsync_ReturnsNull_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.UpdateTableAsync(1, 1, 1, "New", 2));
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = CreateDb(nameof(DeleteTableAsync_ReturnsFalse_WhenNotFound));
        var svc = new RestaurantManagementService(db);
        Assert.False(await svc.DeleteTableAsync(1, 1, 1));
    }

    [Fact]
    public async Task GetAllAsync_ExcludesArchivedRestaurants()
    {
        using AppDbContext db = CreateDb(nameof(GetAllAsync_ExcludesArchivedRestaurants));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Active" });
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
        Assert.Equal("Active", result[0].Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsDto_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Found", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);
        Assert.NotNull(result);
        Assert.Equal("Found", result.Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenArchived()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsNull_WhenArchived));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        Assert.Null(await svc.GetByIdAsync(1));
    }

    [Fact]
    public async Task UpdateAsync_SplitsTags()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_SplitsTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "Italian, Pizza, Casual" });
        Assert.Equal(3, result!.Tags.Length);
        Assert.Contains("Italian", result.Tags);
    }

    [Fact]
    public async Task UpdateAsync_HandlesEmptyTags()
    {
        using AppDbContext db = CreateDb(nameof(UpdateAsync_HandlesEmptyTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Tags = "old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "" });
        Assert.Empty(result!.Tags);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsSection_WhenRestaurantExists()
    {
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_ReturnsSection_WhenRestaurantExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "Patio");
        Assert.NotNull(result);
        Assert.Equal("Patio", result.Name);
        Assert.Empty(result.Tables);
    }

    [Fact]
    public async Task UpdateSectionAsync_UpdatesName_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateSectionAsync_UpdatesName_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Old", RestaurantId = 1 });
        await db.SaveChangesAsync();
        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.UpdateSectionAsync(1, 1, "New");
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = CreateDb(nameof(DeleteSectionAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        bool result = await svc.DeleteSectionAsync(1, 1);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableId);
        Assert.Null(booking.SectionId);
        Assert.False(await db.Sections.AnyAsync(s => s.Id == 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsTable_WhenSectionExists()
    {
        using AppDbContext db = CreateDb(nameof(AddTableAsync_ReturnsTable_WhenSectionExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        TableDto? result = await svc.AddTableAsync(1, 1, "T1", 4);
        Assert.NotNull(result);
        Assert.Equal("T1", result.Name);
        Assert.Equal(4, result.Seats);
    }

    [Fact]
    public async Task UpdateTableAsync_UpdatesNameAndSeats_WhenFound()
    {
        using AppDbContext db = CreateDb(nameof(UpdateTableAsync_UpdatesNameAndSeats_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "Old", Seats = 2, SectionId = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        TableDto? result = await svc.UpdateTableAsync(1, 1, 1, "New", 6);
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
        Assert.Equal(6, result.Seats);
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = CreateDb(nameof(DeleteTableAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        bool result = await svc.DeleteTableAsync(1, 1, 1);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableId);
        Assert.False(await db.Tables.AnyAsync(t => t.Id == 1));
    }

    // ── SortOrder / reorderable sections (#178) ──────────────────────────────

    [Fact]
    public async Task GetByIdAsync_OrdersSectionsBySortOrder_ThenById()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_OrdersSectionsBySortOrder_ThenById));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        // Inserted out of SortOrder order, and out of alphabetical order too, to prove
        // neither insertion order nor name drives the result.
        db.Sections.Add(new Section { Id = 1, Name = "Zebra", RestaurantId = 1, SortOrder = 2 });
        db.Sections.Add(new Section { Id = 2, Name = "Alpha", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 3, Name = "Middle", RestaurantId = 1, SortOrder = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(["Alpha", "Middle", "Zebra"], result!.Sections.Select(s => s.Name));
    }

    [Fact]
    public async Task GetByIdAsync_OrdersBySections_TieBreaksById_WhenSortOrderEqual()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_OrdersBySections_TieBreaksById_WhenSortOrderEqual));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 2, Name = "Second", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.Equal(["First", "Second"], result!.Sections.Select(s => s.Name));
    }

    [Fact]
    public async Task AddSectionAsync_AppendsSortOrder_AtEndOfExistingSections()
    {
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_AppendsSortOrder_AtEndOfExistingSections));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Existing1", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 2, Name = "Existing2", RestaurantId = 1, SortOrder = 1 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "New");

        Assert.NotNull(result);
        Assert.Equal(2, result!.SortOrder);
        Section saved = await db.Sections.SingleAsync(s => s.Name == "New");
        Assert.Equal(2, saved.SortOrder);
    }

    [Fact]
    public async Task AddSectionAsync_FirstSection_GetsSortOrderZero()
    {
        using AppDbContext db = CreateDb(nameof(AddSectionAsync_FirstSection_GetsSortOrderZero));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "Only");

        Assert.NotNull(result);
        Assert.Equal(0, result!.SortOrder);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsEmptySections_WhenRestaurantHasNone()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_ReturnsEmptySections_WhenRestaurantHasNone));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Empty(result!.Sections);
    }

    [Fact]
    public async Task GetByIdAsync_OrdersSingleSection_WithoutError()
    {
        using AppDbContext db = CreateDb(nameof(GetByIdAsync_OrdersSingleSection_WithoutError));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Only", RestaurantId = 1, SortOrder = 0 });
        await db.SaveChangesAsync();

        var svc = new RestaurantManagementService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(["Only"], result!.Sections.Select(s => s.Name));
    }
}
