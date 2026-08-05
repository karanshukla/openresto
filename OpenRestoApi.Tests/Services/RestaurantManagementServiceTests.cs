using Microsoft.EntityFrameworkCore;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class RestaurantManagementServiceTests
{
    private static RestaurantManagementService CreateService(AppDbContext db) => new(
        new RestaurantRepository(db),
        new SectionRepository(db),
        new TableRepository(db),
        new BookingRepository(db),
        new TableGroupRepository(db));

    [Fact]
    public async Task GetAllAsync_ReturnsAll()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_ReturnsAll));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsNull_WhenNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.GetByIdAsync(999));
    }

    [Fact]
    public async Task CreateAsync_HandlesNestedEntities()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_HandlesNestedEntities));
        var svc = CreateService(db);
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
    public async Task CreateAsync_HonorsCallerSuppliedOpenTimeCloseTimeOpenDaysAndTimezone()
    {
        // Regression test (see the comment above the mapping in CreateAsync): hours/days/
        // timezone the client sends must be persisted, not silently reverted to the
        // "OpenTime omitted" defaults — those defaults should only kick in when the caller
        // truly omits the field (see CreateAsync_HandlesNestedEntities and friends, which all
        // omit these fields and so only exercise the "use default" branch).
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_HonorsCallerSuppliedOpenTimeCloseTimeOpenDaysAndTimezone));
        var svc = CreateService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            OpenTime = "08:00",
            CloseTime = "20:00",
            OpenDays = "1,3,5",
            Timezone = "America/New_York",
        };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal("08:00", result.OpenTime);
        Assert.Equal("20:00", result.CloseTime);
        Assert.Equal("1,3,5", result.OpenDays);
        Assert.Equal("America/New_York", result.Timezone);

        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.Equal("08:00", entity!.OpenTime);
        Assert.Equal("20:00", entity.CloseTime);
        Assert.Equal("1,3,5", entity.OpenDays);
        Assert.Equal("America/New_York", entity.Timezone);
    }

    [Fact]
    public async Task CreateAsync_AppliesPerDayOpenHours_FromDto()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_AppliesPerDayOpenHours_FromDto));
        var svc = CreateService(db);
        var dto = new RestaurantDto
        {
            Name = "New",
            OpenHours =
            [
                new DayHoursDto { Day = 6, Open = "12:00", Close = "16:00" },
                new DayHoursDto { Day = 7, Open = "12:00", Close = "16:00" },
            ],
        };

        RestaurantDto result = await svc.CreateAsync(dto);

        DayHoursDto saturday = result.OpenHours!.Single(h => h.Day == 6);
        Assert.Equal("12:00", saturday.Open);
        Assert.Equal("16:00", saturday.Close);

        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.NotNull(entity!.OpenHoursJson);
    }

    [Fact]
    public async Task CreateAsync_AssignsSequentialSortOrder_ToBulkCreatedSections()
    {
        // Regression test (#178 review): CreateAsync previously omitted SortOrder from the
        // bulk section-creation mapping, so every section created through this path defaulted
        // to SortOrder = 0 instead of reflecting the order the caller supplied them in.
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_AssignsSequentialSortOrder_ToBulkCreatedSections));
        var svc = CreateService(db);
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
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_CopiesDefaultBookingDurationMinutes_FromDto));
        var svc = CreateService(db);
        var dto = new RestaurantDto { Name = "New", DefaultBookingDurationMinutes = 90 };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal(90, result.DefaultBookingDurationMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.Equal(90, entity!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task CreateAsync_CopiesBookingSlotIntervalMinutes_FromDto()
    {
        // Regression test (#245): CreateAsync must map BookingSlotIntervalMinutes through,
        // not silently drop it to the entity default (30).
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_CopiesBookingSlotIntervalMinutes_FromDto));
        var svc = CreateService(db);
        var dto = new RestaurantDto { Name = "New", BookingSlotIntervalMinutes = 15 };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal(15, result.BookingSlotIntervalMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.Equal(15, entity!.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task CreateAsync_CopiesMaxTableOversizeSeats_FromDto()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(CreateAsync_CopiesMaxTableOversizeSeats_FromDto));
        var svc = CreateService(db);
        var dto = new RestaurantDto { Name = "New", MaxTableOversizeSeats = 2 };

        RestaurantDto result = await svc.CreateAsync(dto);

        Assert.Equal(2, result.MaxTableOversizeSeats);
        Restaurant? entity = await db.Restaurants.FindAsync(result.Id);
        Assert.Equal(2, entity!.MaxTableOversizeSeats);
    }

    [Fact]
    public async Task CreateAsync_LeavesMaxTableOversizeSeatsNull_WhenDtoOmitsIt()
    {
        using AppDbContext db = TestDbFactory.Create(
            nameof(CreateAsync_LeavesMaxTableOversizeSeatsNull_WhenDtoOmitsIt));
        var svc = CreateService(db);
        var dto = new RestaurantDto { Name = "New" };

        RestaurantDto result = await svc.CreateAsync(dto);

        // Null means "off/unrestricted" — the default for new and existing restaurants.
        Assert.Null(result.MaxTableOversizeSeats);
    }

    [Fact]
    public async Task UpdateAsync_PersistsMaxTableOversizeSeats()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_PersistsMaxTableOversizeSeats));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MaxTableOversizeSeats = 1
        });

        Assert.Equal(1, result!.MaxTableOversizeSeats);
        Restaurant entity = await db.Restaurants.SingleAsync();
        Assert.Equal(1, entity.MaxTableOversizeSeats);
    }

    [Fact]
    public async Task UpdateAsync_ClearsMaxTableOversizeSeats_WhenRequestIsNull()
    {
        // The settings form always sends the field (number or null); null must clear a
        // previously-set cap so the admin can toggle the setting "Off".
        using AppDbContext db = TestDbFactory.Create(
            nameof(UpdateAsync_ClearsMaxTableOversizeSeats_WhenRequestIsNull));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", MaxTableOversizeSeats = 2 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MaxTableOversizeSeats = null
        });

        Assert.Null(result!.MaxTableOversizeSeats);
        Restaurant entity = await db.Restaurants.SingleAsync();
        Assert.Null(entity.MaxTableOversizeSeats);
    }

    [Fact]
    public async Task UpdateAsync_RejectsNegativeMaxTableOversizeSeats()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_RejectsNegativeMaxTableOversizeSeats));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MaxTableOversizeSeats = -1
        }));
    }

    [Fact]
    public async Task UpdateAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_ReturnsNull_WhenNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.UpdateAsync(999, new UpdateRestaurantRequest()));
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_UpdatesFields));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
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

    // ── Description blurb (#184) ──────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_Persists_Description_Trimmed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Persists_Description_Trimmed));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            Description = "  A cozy spot with [menu](https://example.com) links.  "
        });

        Assert.NotNull(result);
        Assert.Equal("A cozy spot with [menu](https://example.com) links.", result.Description);
    }

    [Fact]
    public async Task UpdateAsync_Clears_Description_WhenBlank()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Clears_Description_WhenBlank));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", Description = "Old blurb" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            Description = "   "
        });

        Assert.NotNull(result);
        Assert.Null(result.Description);
    }

    [Fact]
    public async Task UpdateAsync_Persists_MenuUrl_Trimmed()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Persists_MenuUrl_Trimmed));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MenuUrl = "  https://example.com/menu.pdf  "
        });

        Assert.NotNull(result);
        Assert.Equal("https://example.com/menu.pdf", result.MenuUrl);
    }

    [Fact]
    public async Task UpdateAsync_Clears_MenuUrl_WhenBlank()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Clears_MenuUrl_WhenBlank));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", MenuUrl = "https://old.example.com/menu.pdf" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MenuUrl = "   "
        });

        Assert.NotNull(result);
        Assert.Null(result.MenuUrl);
    }

    [Theory]
    [InlineData("asdf")]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://example.com/menu.pdf")]
    [InlineData("mailto:hello@example.com")]
    public async Task UpdateAsync_RejectsInvalidMenuUrl(string menuUrl)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(UpdateAsync_RejectsInvalidMenuUrl)}_{menuUrl}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MenuUrl = menuUrl,
        }));

        // Unchanged — validation throws before assignment.
        Assert.Null((await db.Restaurants.FindAsync(1))!.MenuUrl);
    }

    [Fact]
    public async Task UpdateAsync_AcceptsServedMenuPath()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_AcceptsServedMenuPath));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        // The /media/menu-<id>.pdf path is written by MediaService.UploadMenuAsync and must
        // not be rejected by URL validation (it's a relative served-file path, not absolute).
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MenuUrl = "/media/menu-1.pdf?v=123",
        });

        Assert.NotNull(result);
        Assert.Equal("/media/menu-1.pdf?v=123", result.MenuUrl);
    }

    [Fact]
    public async Task UpdateAsync_AcceptsExternalHttpsMenuUrl()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_AcceptsExternalHttpsMenuUrl));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            MenuUrl = "https://example.com/menu.pdf",
        });

        Assert.NotNull(result);
        Assert.Equal("https://example.com/menu.pdf", result.MenuUrl);
    }

    [Fact]
    public async Task UpdateAsync_Keeps_Description_WhenNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Keeps_Description_WhenNull));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", Description = "Persisted blurb" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        // No Description on the request → PATCH leaves it untouched.
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R2" });

        Assert.NotNull(result);
        Assert.Equal("Persisted blurb", result.Description);
    }

    [Fact]
    public async Task GetByIdAsync_Returns_Description()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_Returns_Description));
        db.Restaurants.Add(new Restaurant
        {
            Id = 1,
            Name = "R",
            Timezone = "UTC",
            Description = "Our little place"
        });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal("Our little place", result.Description);
    }

    // ── Per-day opening hours (#175) ─────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_StoresPerDayHours_AndReturnsResolvedWeek()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_StoresPerDayHours_AndReturnsResolvedWeek));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", OpenTime = "09:00", CloseTime = "22:00", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

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
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_CollapsesUniformPerDayHours_IntoOpenCloseTime));
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
        var svc = CreateService(db);

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
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_Throws_WhenOpenHoursInvalid));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var invalid = new List<DayHoursDto> { new() { Day = 9, Open = "10:00", Close = "20:00" } };

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", OpenHours = invalid }));
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsResolvedOpenHours()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsResolvedOpenHours));
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
        var svc = CreateService(db);

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
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsDefaultBookingDurationMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", DefaultBookingDurationMinutes = 90 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
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
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_UpdatesDefaultBookingDurationMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = 120 });

        Assert.Equal(120, result!.DefaultBookingDurationMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(1);
        Assert.Equal(120, entity!.DefaultBookingDurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_KeepsExistingDuration_WhenNotProvided()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_KeepsExistingDuration_WhenNotProvided));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", DefaultBookingDurationMinutes = 90 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

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
        using AppDbContext db = TestDbFactory.Create($"{nameof(UpdateAsync_Throws_WhenDurationNotInAllowedSet)}_{invalidDuration}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = invalidDuration }));
    }

    [Theory]
    [InlineData(30)]
    [InlineData(60)]
    [InlineData(90)]
    [InlineData(480)]
    public async Task UpdateAsync_Accepts_WhenDurationInAllowedSet(int validDuration)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(UpdateAsync_Accepts_WhenDurationInAllowedSet)}_{validDuration}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", DefaultBookingDurationMinutes = validDuration });

        Assert.Equal(validDuration, result!.DefaultBookingDurationMinutes);
    }

    // ── BookingSlotIntervalMinutes (#245) ────────────────────────────────────
    // Mirrors the DefaultBookingDurationMinutes coverage above: the interval is a separate
    // restaurant-level setting (the step between selectable start times), decoupled from the
    // booking duration. Defaults to 30 and is constrained to {15, 30, 60} server-side.

    [Fact]
    public async Task GetByIdAsync_ReturnsBookingSlotIntervalMinutes()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsBookingSlotIntervalMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", BookingSlotIntervalMinutes = 15 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);
        Assert.Equal(15, result!.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task RestaurantDto_DefaultsBookingSlotIntervalTo30()
    {
        var dto = new RestaurantDto();
        Assert.Equal(30, dto.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesBookingSlotIntervalMinutes()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_UpdatesBookingSlotIntervalMinutes));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", BookingSlotIntervalMinutes = 15 });

        Assert.Equal(15, result!.BookingSlotIntervalMinutes);
        Restaurant? entity = await db.Restaurants.FindAsync(1);
        Assert.Equal(15, entity!.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task UpdateAsync_KeepsExistingInterval_WhenNotProvided()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_KeepsExistingInterval_WhenNotProvided));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC", BookingSlotIntervalMinutes = 15 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R" });

        Assert.Equal(15, result!.BookingSlotIntervalMinutes);
    }

    [Theory]
    [InlineData(45)]
    [InlineData(0)]
    [InlineData(-15)]
    [InlineData(120)]
    public async Task UpdateAsync_Throws_WhenIntervalNotInAllowedSet(int invalidInterval)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(UpdateAsync_Throws_WhenIntervalNotInAllowedSet)}_{invalidInterval}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", BookingSlotIntervalMinutes = invalidInterval }));
    }

    [Theory]
    [InlineData(15)]
    [InlineData(30)]
    [InlineData(60)]
    public async Task UpdateAsync_Accepts_WhenIntervalInAllowedSet(int validInterval)
    {
        using AppDbContext db = TestDbFactory.Create($"{nameof(UpdateAsync_Accepts_WhenIntervalInAllowedSet)}_{validInterval}");
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Name = "R", BookingSlotIntervalMinutes = validInterval });

        Assert.Equal(validInterval, result!.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task UpdateAsync_DurationAndInterval_CanDiffer()
    {
        // The whole point of #245: a 90-minute booking duration with a 15-minute start-time
        // interval must round-trip without either value rejecting the other.
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_DurationAndInterval_CanDiffer));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest
        {
            Name = "R",
            DefaultBookingDurationMinutes = 90,
            BookingSlotIntervalMinutes = 15
        });

        Assert.Equal(90, result!.DefaultBookingDurationMinutes);
        Assert.Equal(15, result.BookingSlotIntervalMinutes);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddSectionAsync_ReturnsNull_WhenRestaurantNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.AddSectionAsync(999, "S1"));
    }

    [Fact]
    public async Task UpdateSectionAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateSectionAsync_ReturnsNull_WhenNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.UpdateSectionAsync(1, 1, "New"));
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteSectionAsync_ReturnsFalse_WhenNotFound));
        var svc = CreateService(db);
        Assert.False(await svc.DeleteSectionAsync(1, 1));
    }

    [Fact]
    public async Task AddTableAsync_ReturnsNull_WhenSectionNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableAsync_ReturnsNull_WhenSectionNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.AddTableAsync(1, 1, "T1", 4));
    }

    [Fact]
    public async Task UpdateTableAsync_ReturnsNull_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableAsync_ReturnsNull_WhenNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.UpdateTableAsync(1, 1, 1, "New", 2));
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsFalse_WhenNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableAsync_ReturnsFalse_WhenNotFound));
        var svc = CreateService(db);
        Assert.False(await svc.DeleteTableAsync(1, 1, 1));
    }

    [Fact]
    public async Task GetAllAsync_ExcludesArchivedRestaurants()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_ExcludesArchivedRestaurants));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Active" });
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        List<RestaurantDto> result = await svc.GetAllAsync();
        Assert.Single(result);
        Assert.Equal("Active", result[0].Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsDto_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsDto_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Found", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);
        Assert.NotNull(result);
        Assert.Equal("Found", result.Name);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsConfiguredWalkInDays_WhenSet()
    {
        // WalkInDays defaults to null on the entity — ToDto's `r.WalkInDays ?? ""` fallback is
        // otherwise only ever exercised via the null branch across this file's other tests.
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsConfiguredWalkInDays_WhenSet));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Found", Timezone = "UTC", WalkInDays = "6,7" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.Equal("6,7", result!.WalkInDays);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNull_WhenArchived()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsNull_WhenArchived));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Archived", IsArchived = true });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        Assert.Null(await svc.GetByIdAsync(1));
    }

    [Fact]
    public async Task UpdateAsync_SplitsTags()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_SplitsTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "Italian, Pizza, Casual" });
        Assert.Equal(3, result!.Tags.Length);
        Assert.Contains("Italian", result.Tags);
    }

    [Fact]
    public async Task UpdateAsync_HandlesEmptyTags()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateAsync_HandlesEmptyTags));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R", Tags = "old", Timezone = "UTC" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        RestaurantDto? result = await svc.UpdateAsync(1, new UpdateRestaurantRequest { Tags = "" });
        Assert.Empty(result!.Tags);
    }

    [Fact]
    public async Task AddSectionAsync_ReturnsSection_WhenRestaurantExists()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddSectionAsync_ReturnsSection_WhenRestaurantExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "Patio");
        Assert.NotNull(result);
        Assert.Equal("Patio", result.Name);
        Assert.Empty(result.Tables);
    }

    [Fact]
    public async Task UpdateSectionAsync_UpdatesName_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateSectionAsync_UpdatesName_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Old", RestaurantId = 1 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        SectionDto? result = await svc.UpdateSectionAsync(1, 1, "New");
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
    }

    [Fact]
    public async Task DeleteSectionAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteSectionAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
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
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableAsync_ReturnsTable_WhenSectionExists));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        TableDto? result = await svc.AddTableAsync(1, 1, "T1", 4);
        Assert.NotNull(result);
        Assert.Equal("T1", result.Name);
        Assert.Equal(4, result.Seats);
    }

    [Fact]
    public async Task UpdateTableAsync_UpdatesNameAndSeats_WhenFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableAsync_UpdatesNameAndSeats_WhenFound));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "Old", Seats = 2, SectionId = 1 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        TableDto? result = await svc.UpdateTableAsync(1, 1, 1, "New", 6);
        Assert.NotNull(result);
        Assert.Equal("New", result.Name);
        Assert.Equal(6, result.Seats);
    }

    [Fact]
    public async Task DeleteTableAsync_ReturnsTrue_AndNullsBookings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableAsync_ReturnsTrue_AndNullsBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = DateTime.UtcNow, BookingRef = "REF1" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        bool result = await svc.DeleteTableAsync(1, 1, 1);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableId);
        Assert.False(await db.Tables.AnyAsync(t => t.Id == 1));
    }

    // ── Delete-impact reads (two-step delete friction, #270) ─────────────────
    //
    // The impact count is the number shown to the admin in the inline confirm step — it must count
    // only non-cancelled future bookings (those a live restaurant cares about losing the reference
    // for), and null out when the table/section doesn't exist or belongs to another restaurant.

    [Fact]
    public async Task GetTableDeleteImpactAsync_ReturnsNull_WhenTableNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpactAsync_ReturnsNull_WhenTableNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.GetTableDeleteImpactAsync(1, 1, 1));
    }

    [Fact]
    public async Task GetTableDeleteImpactAsync_CountsFutureNonCancelledBookings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpactAsync_CountsFutureNonCancelledBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        DateTime now = DateTime.UtcNow;
        // 2 future + active on this table → counted.
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(1), BookingRef = "F1" });
        db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddDays(2), BookingRef = "F2" });
        // 1 future but cancelled → excluded.
        db.Bookings.Add(new Booking { Id = 3, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(3), BookingRef = "C1", IsCancelled = true });
        // 1 past + active → excluded (the booking already happened; losing the ref is moot).
        db.Bookings.Add(new Booking { Id = 4, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(-2), BookingRef = "P1" });
        // 1 future on a different table → excluded.
        db.Tables.Add(new Table { Id = 2, Seats = 4, SectionId = 1 });
        db.Bookings.Add(new Booking { Id = 5, RestaurantId = 1, TableId = 2, SectionId = 1, Date = now.AddHours(4), BookingRef = "OTHER" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        DeleteImpactDto? result = await svc.GetTableDeleteImpactAsync(1, 1, 1);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Bookings);
    }

    [Fact]
    public async Task GetTableDeleteImpactAsync_ReturnsZero_WhenNoFutureBookings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpactAsync_ReturnsZero_WhenNoFutureBookings));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        DeleteImpactDto? result = await svc.GetTableDeleteImpactAsync(1, 1, 1);

        Assert.NotNull(result);
        Assert.Equal(0, result!.Bookings);
    }

    [Fact]
    public async Task GetSectionDeleteImpactAsync_ReturnsNull_WhenSectionNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetSectionDeleteImpactAsync_ReturnsNull_WhenSectionNotFound));
        var svc = CreateService(db);
        Assert.Null(await svc.GetSectionDeleteImpactAsync(1, 1));
    }

    [Fact]
    public async Task GetSectionDeleteImpactAsync_CountsFutureNonCancelledAcrossSectionAndItsTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetSectionDeleteImpactAsync_CountsFutureNonCancelledAcrossSectionAndItsTables));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Seats = 4, SectionId = 1 });
        DateTime now = DateTime.UtcNow;
        // Future booking matched by TableId (table 1) → counted.
        db.Bookings.Add(new Booking { Id = 1, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(1), BookingRef = "BT" });
        // Future booking matched by SectionId only (table ref already null, e.g. walk-in assigned to section) → counted.
        db.Bookings.Add(new Booking { Id = 2, RestaurantId = 1, TableId = null, SectionId = 1, Date = now.AddHours(2), BookingRef = "BS" });
        // Future booking on table 2 → counted.
        db.Bookings.Add(new Booking { Id = 3, RestaurantId = 1, TableId = 2, SectionId = 1, Date = now.AddHours(3), BookingRef = "BT2" });
        // Cancelled future on table 1 → excluded.
        db.Bookings.Add(new Booking { Id = 4, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(4), BookingRef = "CX", IsCancelled = true });
        // Past active on table 1 → excluded.
        db.Bookings.Add(new Booking { Id = 5, RestaurantId = 1, TableId = 1, SectionId = 1, Date = now.AddHours(-1), BookingRef = "PAST" });
        // Future on a different section → excluded.
        db.Sections.Add(new Section { Id = 2, Name = "Other", RestaurantId = 1 });
        db.Bookings.Add(new Booking { Id = 6, RestaurantId = 1, TableId = null, SectionId = 2, Date = now.AddHours(5), BookingRef = "OTHERSEC" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        DeleteImpactDto? result = await svc.GetSectionDeleteImpactAsync(1, 1);

        Assert.NotNull(result);
        Assert.Equal(3, result!.Bookings);
    }

    // ── SortOrder / reorderable sections (#178) ──────────────────────────────

    [Fact]
    public async Task GetByIdAsync_OrdersSectionsBySortOrder_ThenById()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_OrdersSectionsBySortOrder_ThenById));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        // Inserted out of SortOrder order, and out of alphabetical order too, to prove
        // neither insertion order nor name drives the result.
        db.Sections.Add(new Section { Id = 1, Name = "Zebra", RestaurantId = 1, SortOrder = 2 });
        db.Sections.Add(new Section { Id = 2, Name = "Alpha", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 3, Name = "Middle", RestaurantId = 1, SortOrder = 1 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(["Alpha", "Middle", "Zebra"], result!.Sections.Select(s => s.Name));
    }

    [Fact]
    public async Task GetByIdAsync_OrdersBySections_TieBreaksById_WhenSortOrderEqual()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_OrdersBySections_TieBreaksById_WhenSortOrderEqual));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 2, Name = "Second", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 1, Name = "First", RestaurantId = 1, SortOrder = 0 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.Equal(["First", "Second"], result!.Sections.Select(s => s.Name));
    }

    [Fact]
    public async Task AddSectionAsync_AppendsSortOrder_AtEndOfExistingSections()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddSectionAsync_AppendsSortOrder_AtEndOfExistingSections));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Existing1", RestaurantId = 1, SortOrder = 0 });
        db.Sections.Add(new Section { Id = 2, Name = "Existing2", RestaurantId = 1, SortOrder = 1 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "New");

        Assert.NotNull(result);
        Assert.Equal(2, result!.SortOrder);
        Section saved = await db.Sections.SingleAsync(s => s.Name == "New");
        Assert.Equal(2, saved.SortOrder);
    }

    [Fact]
    public async Task AddSectionAsync_FirstSection_GetsSortOrderZero()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddSectionAsync_FirstSection_GetsSortOrderZero));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        SectionDto? result = await svc.AddSectionAsync(1, "Only");

        Assert.NotNull(result);
        Assert.Equal(0, result!.SortOrder);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsEmptySections_WhenRestaurantHasNone()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsEmptySections_WhenRestaurantHasNone));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Empty(result!.Sections);
    }

    [Fact]
    public async Task GetByIdAsync_OrdersSingleSection_WithoutError()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_OrdersSingleSection_WithoutError));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "Only", RestaurantId = 1, SortOrder = 0 });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Equal(["Only"], result!.Sections.Select(s => s.Name));
    }

    // ── Combinable table groups (#271) ──────────────────────────────────────
    //
    // A group is a bookable unit of physical tables pushed together. Service enforces every data-
    // integrity rule (in-memory provider used here ignores SQL constraints, so the unique index on
    // TableId is the production backstop): members exist + belong to the same restaurant, aren't
    // already grouped, >= 2 members, and CombinedSeats inside (largest member .. sum of members].

    private static async Task SeedTwoRestaurantsWithTablesAsync(AppDbContext db)
    {
        // Restaurant 1 — section 1 with tables 1, 2, 3.
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        db.Sections.Add(new Section { Id = 1, Name = "S1", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 3, Seats = 2, SectionId = 1 });
        // Restaurant 2 — section 2 with table 4.
        db.Restaurants.Add(new Restaurant { Id = 2, Name = "R2" });
        db.Sections.Add(new Section { Id = 2, Name = "S2", RestaurantId = 2 });
        db.Tables.Add(new Table { Id = 4, Seats = 6, SectionId = 2 });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task AddTableGroupAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_ReturnsNull_WhenRestaurantNotFound));
        var svc = CreateService(db);
        TableGroupDto? result = await svc.AddTableGroupAsync(999, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });
        Assert.Null(result);
    }

    [Fact]
    public async Task AddTableGroupAsync_CreatesGroup_FromTwoTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_CreatesGroup_FromTwoTables));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        TableGroupDto? result = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Name = "Window booths",
            Members = [1, 2],
            CombinedSeats = 8
        });

        Assert.NotNull(result);
        Assert.Equal("Window booths", result!.Name);
        Assert.Equal(8, result.CombinedSeats);
        Assert.Equal([1, 2], result.Members.Select(m => m.Id));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsFewerThanTwoMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsFewerThanTwoMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1], CombinedSeats = 4 }));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsDuplicateMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsDuplicateMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 1], CombinedSeats = 4 }));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsMemberFromDifferentRestaurant()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsMemberFromDifferentRestaurant));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        // Table 4 belongs to restaurant 2 — must be rejected when grouping under restaurant 1.
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 4], CombinedSeats = 10 }));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsTableAlreadyInAnotherGroup()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsTableAlreadyInAnotherGroup));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });

        // Table 1 is now grouped — a second group including it must be rejected.
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 3], CombinedSeats = 6 }));
    }

    [Fact]
    public async Task AddTableGroupAsync_AllowsCombinedSeatsBelowSumOfMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_AllowsCombinedSeatsBelowSumOfMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        // Tables 1+2 seat 4+4 = 8, but pushing them together loses the covers where the corners
        // meet — 7 (or 6) is the realistic combined figure and must be accepted.
        TableGroupDto? result = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 7
        });
        Assert.NotNull(result);
        Assert.Equal(7, result!.CombinedSeats);
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsCombinedSeatsAboveSumOfMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsCombinedSeatsAboveSumOfMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        // Combining tables cannot invent covers: 10 > 4 + 4.
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 10 }));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsCombinedSeatsNotBeatingLargestMember()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsCombinedSeatsNotBeatingLargestMember));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        // Tables 1 (4 seats) + 3 (2 seats): a combined figure of 4 seats no more than table 1 does
        // on its own, so the group would be pointless — and would shadow table 1 in the ordering.
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 3], CombinedSeats = 4 }));
    }

    [Fact]
    public async Task UpdateTableGroupAsync_RenamesAndSwapsMembersAndCombinedSeats()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableGroupAsync_RenamesAndSwapsMembersAndCombinedSeats));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        TableGroupDto? created = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Name = "Old",
            Members = [1, 2],
            CombinedSeats = 8
        });

        // Swap table 2 out for table 3, rename, set combined seats to the new sum (4+2).
        TableGroupDto? updated = await svc.UpdateTableGroupAsync(1, created!.Id, new UpdateTableGroupRequest
        {
            Name = "New",
            Members = [1, 3],
            CombinedSeats = 6
        });

        Assert.NotNull(updated);
        Assert.Equal("New", updated!.Name);
        Assert.Equal(6, updated.CombinedSeats);
        Assert.Equal([1, 3], updated.Members.Select(m => m.Id));

        // The removed table (2) is now ungrouped, so it can form a new group with another free table.
        // Table 3 is taken by the group just updated, so this must instead reject.
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [2, 3], CombinedSeats = 6 }));
    }

    [Fact]
    public async Task UpdateTableGroupAsync_ReturnsNull_WhenGroupNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableGroupAsync_ReturnsNull_WhenGroupNotFound));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        TableGroupDto? result = await svc.UpdateTableGroupAsync(1, 999, new UpdateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 8
        });
        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateTableGroupAsync_AllowsKeepingOwnMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableGroupAsync_AllowsKeepingOwnMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        TableGroupDto? created = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 8
        });

        // Re-submitting the same members (a rename-only update) must not trip the "already grouped" rule.
        TableGroupDto? updated = await svc.UpdateTableGroupAsync(1, created!.Id, new UpdateTableGroupRequest
        {
            Name = "Renamed",
            Members = [1, 2],
            CombinedSeats = 8
        });

        Assert.NotNull(updated);
        Assert.Equal("Renamed", updated!.Name);
    }

    [Fact]
    public async Task DeleteTableGroupAsync_ReturnsFalse_WhenGroupNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableGroupAsync_ReturnsFalse_WhenGroupNotFound));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        Assert.False(await svc.DeleteTableGroupAsync(1, 999));
    }

    [Fact]
    public async Task DeleteTableGroupAsync_RemovesGroupAndClearsBookingReferences()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableGroupAsync_RemovesGroupAndClearsBookingReferences));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        TableGroupDto? group = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Members = [1, 2],
            CombinedSeats = 8
        });
        // A booking referencing the group.
        db.Bookings.Add(new Booking
        {
            Id = 1,
            RestaurantId = 1,
            TableGroupId = group!.Id,
            Date = DateTime.UtcNow.AddDays(1),
            BookingRef = "G1"
        });
        await db.SaveChangesAsync();

        bool result = await svc.DeleteTableGroupAsync(1, group.Id);

        Assert.True(result);
        Booking? booking = await db.Bookings.FindAsync(1);
        Assert.Null(booking!.TableGroupId); // FK-null equivalent
        Assert.False(await db.TableGroups.AnyAsync(g => g.Id == group.Id));
        Assert.False(await db.TableGroupMemberships.AnyAsync(m => m.TableGroupId == group.Id));
    }

    [Fact]
    public async Task GetByIdAsync_IncludesGroupsWithMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_IncludesGroupsWithMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest
        {
            Name = "Booths",
            Members = [1, 2],
            CombinedSeats = 8
        });

        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        TableGroupDto group = Assert.Single(result!.Groups);
        Assert.Equal("Booths", group.Name);
        Assert.Equal(8, group.CombinedSeats);
        Assert.Equal([1, 2], group.Members.Select(m => m.Id));
    }

    [Fact]
    public async Task GetAllAsync_IncludesGroupsWithMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetAllAsync_IncludesGroupsWithMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 3], CombinedSeats = 6 });

        List<RestaurantDto> result = await svc.GetAllAsync();

        RestaurantDto r1 = result.Single(r => r.Id == 1);
        TableGroupDto group = Assert.Single(r1.Groups);
        Assert.Equal([1, 3], group.Members.Select(m => m.Id));
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsEmptyGroups_WhenNoneDefined()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetByIdAsync_ReturnsEmptyGroups_WhenNoneDefined));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        RestaurantDto? result = await svc.GetByIdAsync(1);

        Assert.NotNull(result);
        Assert.Empty(result!.Groups);
    }

    // ── Seats validation (defense in depth behind the DTO [Range] annotations) ──────────

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(BookingLimits.MaxSeats + 1)]
    public async Task AddTableAsync_RejectsSeatsOutOfRange(int seats)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableAsync_RejectsSeatsOutOfRange) + seats);
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() => svc.AddTableAsync(1, 1, "T1", seats));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    [InlineData(BookingLimits.MaxSeats + 1)]
    public async Task UpdateTableAsync_RejectsSeatsOutOfRange(int seats)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableAsync_RejectsSeatsOutOfRange) + seats);
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R" });
        db.Sections.Add(new Section { Id = 1, Name = "S", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Name = "T1", Seats = 4, SectionId = 1 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateTableAsync(1, 1, 1, "T1", seats));
    }

    [Fact]
    public async Task AddTableGroupAsync_RejectsCombinedSeatsAboveMax()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(AddTableGroupAsync_RejectsCombinedSeatsAboveMax));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.AddTableGroupAsync(1, new CreateTableGroupRequest
            {
                Members = [1, 2],
                CombinedSeats = BookingLimits.MaxSeats + 1
            }));
    }

    // ── Group integrity when member tables change underneath (#242) ─────────
    //
    // The TableGroupMemberships → Tables FK is ON DELETE CASCADE, so a member table's removal drops
    // the membership row without touching the group. Left alone, the group keeps advertising a
    // combined capacity nothing can seat.

    [Fact]
    public async Task DeleteTableAsync_DissolvesGroup_WhenItWouldDropBelowTwoMembers()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableAsync_DissolvesGroup_WhenItWouldDropBelowTwoMembers));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        TableGroupDto? group = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });

        Assert.True(await svc.DeleteTableAsync(1, 1, 2));

        RestaurantDto? restaurant = await svc.GetByIdAsync(1);
        Assert.Empty(restaurant!.Groups);
        Assert.Null(await db.TableGroups.FindAsync(group!.Id));
    }

    [Fact]
    public async Task DeleteTableAsync_FkNullsGroupBookings_WhenTheGroupIsDissolved()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableAsync_FkNullsGroupBookings_WhenTheGroupIsDissolved));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        TableGroupDto? group = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });
        db.Bookings.Add(new Booking
        {
            Id = 90, RestaurantId = 1, TableGroupId = group!.Id, SectionId = 1,
            Date = DateTime.UtcNow.AddDays(3), BookingRef = "GRP1"
        });
        await db.SaveChangesAsync();

        Assert.True(await svc.DeleteTableAsync(1, 1, 2));

        Booking? booking = await db.Bookings.FindAsync(90);
        Assert.NotNull(booking);
        Assert.Null(booking!.TableGroupId);
    }

    [Fact]
    public async Task DeleteTableAsync_ClampsCombinedSeats_WhenTheGroupSurvives()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteTableAsync_ClampsCombinedSeats_WhenTheGroupSurvives));
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "R1" });
        db.Sections.Add(new Section { Id = 1, Name = "S1", RestaurantId = 1 });
        db.Tables.Add(new Table { Id = 1, Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 2, Seats = 4, SectionId = 1 });
        db.Tables.Add(new Table { Id = 3, Seats = 4, SectionId = 1 });
        await db.SaveChangesAsync();
        var svc = CreateService(db);
        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2, 3], CombinedSeats = 12 });

        Assert.True(await svc.DeleteTableAsync(1, 1, 3));

        RestaurantDto? restaurant = await svc.GetByIdAsync(1);
        TableGroupDto group = Assert.Single(restaurant!.Groups);
        Assert.Equal([1, 2], group.Members.Select(m => m.Id));
        Assert.Equal(8, group.CombinedSeats);
    }

    [Fact]
    public async Task DeleteSectionAsync_DissolvesGroups_SpanningItsTables()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteSectionAsync_DissolvesGroups_SpanningItsTables));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });

        Assert.True(await svc.DeleteSectionAsync(1, 1));

        Assert.Empty(db.TableGroups.ToList());
    }

    [Fact]
    public async Task UpdateTableAsync_ClampsCombinedSeats_WhenAMemberShrinks()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UpdateTableAsync_ClampsCombinedSeats_WhenAMemberShrinks));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });

        // Table 2 drops from 4 seats to 2 — the pair can no longer seat 8.
        Assert.NotNull(await svc.UpdateTableAsync(1, 1, 2, "T2", 2));

        RestaurantDto? restaurant = await svc.GetByIdAsync(1);
        TableGroupDto group = Assert.Single(restaurant!.Groups);
        Assert.Equal(6, group.CombinedSeats);
    }

    [Fact]
    public async Task GetTableDeleteImpactAsync_CountsBookingsHeldThroughTheTablesGroup()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(GetTableDeleteImpactAsync_CountsBookingsHeldThroughTheTablesGroup));
        await SeedTwoRestaurantsWithTablesAsync(db);
        var svc = CreateService(db);
        TableGroupDto? group = await svc.AddTableGroupAsync(1, new CreateTableGroupRequest { Members = [1, 2], CombinedSeats = 8 });
        // A group booking stores TableId = null, so the table-only count would report zero impact.
        db.Bookings.Add(new Booking
        {
            Id = 91, RestaurantId = 1, TableGroupId = group!.Id, SectionId = 1,
            Date = DateTime.UtcNow.AddDays(4), BookingRef = "GRP2"
        });
        await db.SaveChangesAsync();

        DeleteImpactDto? impact = await svc.GetTableDeleteImpactAsync(1, 1, 1);

        Assert.Equal(1, impact!.Bookings);
    }
}
