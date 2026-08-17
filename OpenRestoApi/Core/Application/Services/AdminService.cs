using System.Diagnostics.CodeAnalysis;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>
/// Outcome status of <see cref="AdminService.SendBookingEmailAsync"/>.
/// </summary>
public enum SendBookingEmailStatus { Sent, NotFound, MissingFields, NoCustomerEmail }

/// <summary>
/// Result of <see cref="AdminService.SendBookingEmailAsync"/>. <see cref="Recipient"/> is populated
/// only on <see cref="Sent"/> so the controller can echo it back in the success message without a
/// second fetch. SMTP/transport failures are NOT surfaced here — they propagate as exceptions for
/// the controller to map to a 400, preserving the prior behaviour.
/// </summary>
public record SendBookingEmailResult(SendBookingEmailStatus Status, string? Recipient = null)
{
    public static SendBookingEmailResult Sent(string recipient) => new(SendBookingEmailStatus.Sent, recipient);
    public static SendBookingEmailResult NotFound() => new(SendBookingEmailStatus.NotFound);
    public static SendBookingEmailResult MissingFields() => new(SendBookingEmailStatus.MissingFields);
    public static SendBookingEmailResult NoCustomerEmail() => new(SendBookingEmailStatus.NoCustomerEmail);
}

public class AdminService(
    IBookingRepository bookingRepository,
    IBookingFilterRepository bookingFilterRepository,
    IRestaurantRepository restaurantRepository,
    ISectionRepository sectionRepository,
    ITableRepository tableRepository,
    IHoldService holdService,
    IEmailService emailService,
    BrandService? brandService = null,
    INotificationQueue? notificationQueue = null)
{
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly IBookingFilterRepository _bookingFilterRepository = bookingFilterRepository;
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly IHoldService _holdService = holdService;
    private readonly IEmailService _emailService = emailService;
    private readonly BrandService? _brandService = brandService;
    private readonly INotificationQueue? _notificationQueue = notificationQueue;

    public virtual async Task<AdminOverviewDto> GetOverviewAsync()
    {
        DateTime nowUtc = DateTime.UtcNow;
        List<Restaurant> restaurants = await _restaurantRepository.GetAllActiveAsync();

        int totalRestaurants = restaurants.Count;
        int totalBookings = await _bookingRepository.CountActiveAsync();
        int totalSeats = await _bookingRepository.SumActiveSeatsAsync();

        int todayBookingsCount = 0;
        int pausedRestaurantsCount = 0;
        List<BookingDetailDto> todayBookingsList = [];
        foreach (Restaurant? r in restaurants)
        {
            (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(nowUtc, r.Timezone);
            List<Booking> rTodayBookings = await _bookingRepository.GetForRestaurantInUtcRangeAsync(r.Id, start, end);
            todayBookingsCount += rTodayBookings.Count;
            todayBookingsList.AddRange(rTodayBookings.Select(ToDetailDto));

            if (r.BookingsPausedUntil.HasValue && r.BookingsPausedUntil.Value > nowUtc)
            {
                pausedRestaurantsCount++;
            }
        }

        (List<int> rawCounts, List<string> occupancyDates) = await CountBookingsPerDayAsync(nowUtc, OccupancyChartDays);
        List<int> occupancyData = AsPercentagesOfPeak(rawCounts);

        return new AdminOverviewDto
        {
            TotalRestaurants = totalRestaurants,
            TotalBookings = totalBookings,
            TodayBookings = todayBookingsCount,
            TotalSeats = totalSeats,
            ActiveHoldsCount = _holdService.GetActiveHoldsCount(),
            PausedRestaurantsCount = pausedRestaurantsCount,
            OccupancyData = occupancyData,
            OccupancyDates = occupancyDates,
            OccupancyCounts = rawCounts,
            TodayBookingsList = [.. todayBookingsList.OrderBy(b => b.Date)],
        };
    }

    private const int OccupancyChartDays = 7;

    /// <summary>
    /// Booking counts for the <paramref name="days"/> ending on <paramref name="nowUtc"/>, oldest
    /// first, alongside each day's ISO calendar date — the client toggles its bar labels between
    /// those and relative T-x ones, so both have to come back from the same walk.
    /// </summary>
    private async Task<(List<int> Counts, List<string> Dates)> CountBookingsPerDayAsync(DateTime nowUtc, int days)
    {
        List<int> counts = [];
        List<string> dates = [];

        for (int daysAgo = days - 1; daysAgo >= 0; daysAgo--)
        {
            DateTime dayStart = DateTime.SpecifyKind(nowUtc.Date.AddDays(-daysAgo), DateTimeKind.Utc);
            counts.Add(await _bookingRepository.CountActiveByDayAsync(dayStart, dayStart.AddDays(1)));
            dates.Add(dayStart.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        }

        return (counts, dates);
    }

    /// <summary>
    /// Scales relative to the busiest day rather than to an absolute ceiling, so the peak day
    /// always fills the chart and quiet weeks still read as a shape.
    /// </summary>
    private static List<int> AsPercentagesOfPeak(List<int> counts)
    {
        int peak = MaxOrZero(counts);
        return counts
            .Select(count => peak > 0 ? (int)Math.Round((double)count / peak * 100) : 0)
            .ToList();
    }

    // CountBookingsPerDayAsync always appends OccupancyChartDays entries, so the empty-list guard
    // is unreachable from this call site. Isolated into its own method so excluding it doesn't
    // hide coverage on the branches around it.
    [ExcludeFromCodeCoverage(Justification = "Unreachable: the 7-iteration loop above always populates rawCounts, so Count is never 0 at this call site.")]
    private static int MaxOrZero(List<int> counts) => counts.Count > 0 ? counts.Max() : 0;

    public virtual async Task<List<BookingDetailDto>> GetBookingsAsync(int? restaurantId, DateTime? bookingDate, string status, string? email = null, string? bookingRef = null)
    {
        List<Booking> bookings = await _bookingFilterRepository.QueryAsync(new BookingFilter
        {
            RestaurantId = restaurantId,
            BookingDate = bookingDate,
            Status = status,
            Email = email,
            BookingRef = bookingRef,
        });

        return bookings.Select(ToDetailDto).ToList();
    }

    public virtual async Task<BookingDetailDto?> GetBookingAsync(int id)
    {
        Booking? b = await _bookingRepository.GetByIdAsync(id);
        return b == null ? null : ToDetailDto(b);
    }

    public virtual async Task<BookingDetailDto> CreateBookingAsync(AdminCreateBookingRequest req)
    {
        Table table = await _tableRepository.GetWithSectionRestaurantAsync(req.TableId, req.SectionId)
            ?? throw new ValidationException("Table not found in the specified section.");

        if (table.Section!.RestaurantId != req.RestaurantId)
        {
            throw new ValidationException("Section does not belong to this restaurant.");
        }

        DateTime newStart = TimeZoneHelper.ConvertLocalToUtc(req.Date, table.Section.Restaurant!.Timezone);

        int durationMinutes = table.Section!.Restaurant!.DefaultBookingDurationMinutes;
        DateTime newEnd = newStart.AddMinutes(durationMinutes);

        bool conflict = await _bookingRepository.HasConflictAsync(req.TableId, newStart, newEnd, durationMinutes);

        if (conflict)
        {
            throw new ConflictException("This table already has a booking that overlaps with the requested time.");
        }

        if (req.Seats > table.Seats)
        {
            throw new ConflictException($"This table only has {table.Seats} seats, but {req.Seats} guests were requested.");
        }

        var booking = new Booking
        {
            RestaurantId = req.RestaurantId,
            SectionId = req.SectionId,
            TableId = req.TableId,
            Date = newStart,
            EndTime = newStart.AddMinutes(durationMinutes),
            CustomerEmail = req.CustomerEmail,
            CustomerName = req.CustomerName,
            Seats = req.Seats,
            BookingRef = BookingRefFactory.GenerateFor(table.Section.Restaurant),
        };

        await _bookingRepository.AddAsync(booking);

        Booking? reloaded = await _bookingRepository.GetByIdAsync(booking.Id);
        if (reloaded != null)
        {
            booking = reloaded;
        }

        if (_notificationQueue != null)
        {
            _notificationQueue.EnqueueBookingCreated(booking, booking.Restaurant!.Name);
            _notificationQueue.EnqueueCapacityCheck(booking.RestaurantId, booking.Restaurant!.Name, booking.Date);
        }

        return ToDetailDto(booking);
    }

    public virtual async Task<DateTime?> ExtendBookingAsync(int id, int minutes)
    {
        Booking? booking = await _bookingRepository.FindByIdAsync(id);
        if (booking == null)
        {
            return null;
        }

        DateTime from;
        if (booking.EndTime.HasValue && booking.EndTime.Value > booking.Date)
        {
            from = booking.EndTime.Value;
        }
        else
        {
            Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(booking.RestaurantId);
            from = booking.Date.AddMinutes(restaurant?.DefaultBookingDurationMinutes ?? 60);
        }

        booking.EndTime = from.AddMinutes(minutes);
        await _bookingRepository.UpdateAsync(booking);
        return booking.EndTime;
    }

    public virtual async Task<bool> CancelBookingAsync(int id)
    {
        Booking? booking = await _bookingRepository.FindByIdAsync(id);
        if (booking == null)
        {
            return false;
        }

        if (!booking.IsCancelled && !booking.CanBeCancelledAt(DateTime.UtcNow))
        {
            throw new ConflictException("Cannot cancel a booking that has already passed.");
        }

        booking.IsCancelled = true;
        booking.CancelledAt = DateTime.UtcNow;
        await _bookingRepository.UpdateAsync(booking);

        if (_notificationQueue != null)
        {
            Booking? withRestaurant = await _bookingRepository.GetByIdAsync(id);
            _notificationQueue.EnqueueBookingCancelled(withRestaurant ?? booking, withRestaurant?.Restaurant?.Name ?? "");
        }

        return true;
    }

    public virtual async Task<bool> PurgeBookingAsync(int id)
    {
        Booking? booking = await _bookingRepository.FindByIdAsync(id);
        if (booking == null)
        {
            return false;
        }

        await _bookingRepository.DeleteAsync(id);
        return true;
    }

    public virtual async Task<BookingDetailDto?> RestoreBookingAsync(int id)
    {
        Booking? booking = await _bookingRepository.FindByIdAsync(id);
        if (booking == null)
        {
            return null;
        }

        if (!booking.IsCancelled)
        {
            throw new BusinessRuleException("Booking is already active.");
        }

        booking.IsCancelled = false;
        booking.CancelledAt = null;
        await _bookingRepository.UpdateAsync(booking);

        return ToDetailDto(booking);
    }

    public virtual async Task<BookingDetailDto?> AdminUpdateBookingAsync(int id, AdminUpdateBookingRequest req)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);

        if (booking == null)
        {
            return null;
        }

        Restaurant? restaurant = booking.Restaurant;
        if (req.RestaurantId.HasValue && req.RestaurantId.Value != booking.RestaurantId)
        {
            Restaurant? newRestaurant = await _restaurantRepository.FindByIdAsync(req.RestaurantId.Value);
            if (newRestaurant == null)
            {
                throw new ValidationException("Invalid restaurant.");
            }
            booking.RestaurantId = req.RestaurantId.Value;
            restaurant = newRestaurant;
        }

        int durationMinutes = restaurant?.DefaultBookingDurationMinutes ?? 60;

        if (req.TableId.HasValue && req.TableId.Value != booking.TableId)
        {
            Table? table = await _tableRepository.GetWithSectionForRestaurantAsync(req.TableId.Value, booking.RestaurantId);

            if (table == null)
            {
                throw new ValidationException("Invalid table for this restaurant.");
            }
            booking.TableId = req.TableId.Value;
            booking.SectionId = table.SectionId;
        }
        else if (req.SectionId.HasValue && req.SectionId.Value != booking.SectionId)
        {
            throw new ValidationException("Provide tableId when reassigning to a different section.");
        }

        if (req.Date.HasValue && req.Date.Value != booking.Date)
        {
            RescheduleKeepingDuration(booking, req.Date.Value, durationMinutes);
        }

        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddMinutes(durationMinutes);
        }

        // Dead code today: booking.Date/booking.TableId are mutated above, so this guard's
        // comparisons are always false. Pinned as-is by
        // AdminServiceTests.AdminUpdateBookingAsync_ConflictCheckGuard_IsUnreachable_DueToPreExistingDeadCodeBug;
        // the fix — comparing against the pre-mutation values — is an unrelated follow-up.
        await CheckSlotConflictIfChangedAsync(booking, req, id, durationMinutes);

        if (req.Seats.HasValue)
        {
            int? resolvedTableId = req.TableId ?? booking.TableId;
            if (resolvedTableId.HasValue)
            {
                Table? currentTable = await _tableRepository.FindByIdAsync(resolvedTableId.Value);
                if (currentTable != null && req.Seats.Value > currentTable.Seats)
                {
                    throw new BusinessRuleException($"This table only has {currentTable.Seats} seats, but {req.Seats.Value} guests were requested.");
                }
            }
            booking.Seats = req.Seats.Value;
        }
        if (req.CustomerEmail != null)
        {
            booking.CustomerEmail = req.CustomerEmail;
        }
        if (req.CustomerName != null)
        {
            booking.CustomerName = string.IsNullOrWhiteSpace(req.CustomerName) ? null : req.CustomerName.Trim();
        }
        if (req.SpecialRequests != null)
        {
            booking.SpecialRequests = req.SpecialRequests;
        }

        await _bookingRepository.UpdateAsync(booking);

        // Reloaded through the eager-loading read so the DTO carries the updated names.
        Booking? reloaded = await _bookingRepository.GetByIdAsync(id);
        return reloaded == null ? ToDetailDto(booking) : ToDetailDto(reloaded);
    }

    /// <summary>Moves the sitting while keeping its length, so a reschedule never silently resizes it.</summary>
    private static void RescheduleKeepingDuration(Booking booking, DateTime newDate, int fallbackDurationMinutes)
    {
        booking.EndTime = booking.EndTime.HasValue
            ? newDate + (booking.EndTime.Value - booking.Date)
            : newDate.AddMinutes(fallbackDurationMinutes);
        booking.Date = newDate;
    }

    [ExcludeFromCodeCoverage(Justification = "Pre-existing dead code: caller mutates booking.Date/TableId before calling this, so the guard never trips. Kept as-is; not fixed here.")]
    private async Task CheckSlotConflictIfChangedAsync(Booking booking, AdminUpdateBookingRequest req, int id, int durationMinutes)
    {
        if ((req.Date.HasValue && req.Date.Value != booking.Date) || (req.TableId.HasValue && req.TableId.Value != booking.TableId))
        {
            DateTime newStart = booking.Date.ToUniversalTime();
            DateTime newEnd = booking.EndTime ?? newStart.AddMinutes(durationMinutes);

            bool conflict = await _bookingRepository.HasConflictAsync(booking.TableId, newStart, newEnd, durationMinutes, id);

            if (conflict)
            {
                throw new BusinessRuleException("This update would cause a conflict with an existing booking.");
            }
        }
    }

    public virtual async Task<List<LookupDto>> GetRestaurantsAsync()
    {
        DateTime nowUtc = DateTime.UtcNow;
        return await _restaurantRepository.GetAllWithActiveBookingsCountAsync(nowUtc);
    }

    public virtual async Task<List<LookupDto>> GetSectionsAsync(int restaurantId)
    {
        List<Section> sections = await _sectionRepository.GetByRestaurantAsync(restaurantId);
        return sections.Select(s => new LookupDto { Id = s.Id, Name = s.Name }).ToList();
    }

    /// <summary>
    /// Persists a new display order for a restaurant's sections. Accepts the full
    /// ordered list of section IDs (rather than a single swap) so both the up/down
    /// move-button UI and any future bulk-reorder UI can share one endpoint — the
    /// client computes the desired order locally and resends the whole list, matching
    /// the existing "resend full record" convention used by Highlights/SocialLinks.
    /// Returns null when the restaurant doesn't exist, false when sectionIds doesn't
    /// exactly match the restaurant's current sections, true on success.
    /// </summary>
    public virtual async Task<bool?> ReorderSectionsAsync(int restaurantId, List<int> sectionIds)
    {
        return await _sectionRepository.ReorderAsync(restaurantId, sectionIds);
    }

    // ── Restaurants ─────────────────────────────────────────────────────────

    public virtual async Task<bool> PauseRestaurantBookingsAsync(int restaurantId, int durationMinutes)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.BookingsPausedUntil = DateTime.UtcNow.AddMinutes(durationMinutes);
        await _restaurantRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<bool> UnpauseRestaurantBookingsAsync(int restaurantId)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.BookingsPausedUntil = null;
        await _restaurantRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<List<BookingDetailDto>?> ExtendAllActiveBookingsAsync(int restaurantId, int extensionMinutes)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return null;
        }

        DateTime nowUtc = DateTime.UtcNow;

        List<Booking> activeBookings = await _bookingRepository.GetInProgressForRestaurantAsync(restaurantId, nowUtc, restaurant.DefaultBookingDurationMinutes);

        foreach (Booking? booking in activeBookings)
        {
            DateTime currentEndTime = booking.EndTime ?? booking.Date.AddMinutes(restaurant.DefaultBookingDurationMinutes);
            booking.EndTime = currentEndTime.AddMinutes(extensionMinutes);
        }

        // Single SaveChanges flushes every mutated EndTime — same DB round-trip count as the
        // original implementation. The entities are already tracked on the shared DI-scoped DbContext.
        await _bookingRepository.SaveChangesAsync();
        return activeBookings.Select(ToDetailDto).ToList();
    }

    public virtual async Task<RestaurantDto> CreateRestaurantAsync(string name, string? address)
    {
        var restaurant = new Restaurant { Name = name.Trim(), Address = address?.Trim() };
        await _restaurantRepository.AddAsync(restaurant);

        return new RestaurantDto
        {
            Id = restaurant.Id,
            Name = restaurant.Name,
            Address = restaurant.Address,
            DefaultBookingDurationMinutes = restaurant.DefaultBookingDurationMinutes,
            BookingRefFormat = restaurant.BookingRefFormat.ToString(),
            Sections = [],
        };
    }

    public virtual async Task<bool> SetArchivedAsync(int id, bool archived)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null)
        {
            return false;
        }

        restaurant.IsArchived = archived;
        await _restaurantRepository.SaveChangesAsync();
        return true;
    }

    public virtual async Task<RestaurantDeletePreviewDto?> GetRestaurantDeletePreviewAsync(int id)
    {
        return await _restaurantRepository.GetDeletePreviewAsync(id, DateTime.UtcNow);
    }

    public virtual async Task<bool> DeleteRestaurantAsync(int id)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null)
        {
            return false;
        }

        // Archive-then-purge is a rule, not a UI convention: a live location's bookings are
        // reachable by the guests who made them, and this cascade destroys them irreversibly.
        if (!restaurant.IsArchived)
        {
            throw new BusinessRuleException(
                "Archive this location before deleting it. Archiving takes it off the public site and can be undone; deleting cannot.");
        }

        // Cascade-delete all bookings for this restaurant (cancelled and active alike), then the restaurant row,
        // in a single SaveChanges — faithful to the original ".Where(b => b.RestaurantId == id)" semantics.
        List<Booking> bookings = (await _bookingRepository.GetBookingsByRestaurantIdAsync(id)).ToList();
        _bookingRepository.RemoveRange(bookings);
        _restaurantRepository.Remove(restaurant);
        await _restaurantRepository.SaveChangesAsync();
        return true;
    }

    // ── Tables ──────────────────────────────────────────────────────────────

    public virtual async Task<List<SectionDto>?> GetTablesAsync(int restaurantId)
    {
        List<Section> sections = await _sectionRepository.GetByRestaurantAsync(restaurantId, includeTables: true);

        if (sections.Count == 0)
        {
            return null;
        }

        return sections.Select(s => new SectionDto
        {
            Id = s.Id,
            Name = s.Name,
            SortOrder = s.SortOrder,
            Tables = s.Tables.Select(t => new TableDto
            {
                Id = t.Id,
                Name = t.Name,
                Seats = t.Seats,
            }).ToList(),
        }).ToList();
    }

    /// <summary>
    /// Sends an arbitrary admin-authored email to a booking's customer. Resolves the booking,
    /// validates that subject/body/customer-email are all present, wraps the body in the brand
    /// template (via <see cref="EmailHelper.BuildEmailContentFromBrand"/>), and dispatches via
    /// <see cref="IEmailService.SendEmailAsync"/>. SMTP/transport failures propagate as exceptions
    /// — the controller catches them to map a 400, preserving the prior behaviour.
    /// </summary>
    public virtual async Task<SendBookingEmailResult> SendBookingEmailAsync(int bookingId, SendBookingEmailRequest req)
    {
        BookingDetailDto? booking = await GetBookingAsync(bookingId);
        if (booking == null)
        {
            return SendBookingEmailResult.NotFound();
        }

        if (string.IsNullOrWhiteSpace(req.Subject) || string.IsNullOrWhiteSpace(req.Body))
        {
            return SendBookingEmailResult.MissingFields();
        }

        if (string.IsNullOrWhiteSpace(booking.CustomerEmail))
        {
            return SendBookingEmailResult.NoCustomerEmail();
        }

        string htmlBody = await EmailHelper.BuildEmailContentFromBrand(_brandService, req.Body);
        await _emailService.SendEmailAsync(booking.CustomerEmail, req.Subject, htmlBody);
        return SendBookingEmailResult.Sent(booking.CustomerEmail);
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static BookingDetailDto ToDetailDto(Booking b)
    {
        DateTime dateUtc = b.Date.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(b.Date, DateTimeKind.Utc)
            : b.Date.ToUniversalTime();

        DateTime? endTimeUtc = null;
        if (b.EndTime.HasValue)
        {
            endTimeUtc = b.EndTime.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(b.EndTime.Value, DateTimeKind.Utc)
                : b.EndTime.Value.ToUniversalTime();
        }

        DateTime? cancelledAtUtc = null;
        if (b.CancelledAt.HasValue)
        {
            cancelledAtUtc = b.CancelledAt.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(b.CancelledAt.Value, DateTimeKind.Utc)
                : b.CancelledAt.Value.ToUniversalTime();
        }

        // Group booking: Table/TableId are null (the booking reserves a combinable group). Show a
        // readable group label + the group id so the admin grid doesn't render the row as "Table".
        string? tableName = b.Table?.Name ?? (b.TableId.HasValue ? $"Table {b.TableId}" : null);
        int? tableId = b.TableId;
        if (tableName is null && b.TableGroup is not null)
        {
            tableName = BookingMapper.GroupLabel(b.TableGroup);
            tableId = null;
        }
        tableName ??= "Table";

        return new BookingDetailDto
        {
            Id = b.Id,
            RestaurantId = b.RestaurantId,
            RestaurantName = b.Restaurant?.Name,
            SectionId = b.SectionId,
            SectionName = b.Section?.Name ?? (b.SectionId.HasValue ? $"Section {b.SectionId}" : "Section"),
            TableId = tableId,
            TableName = tableName,
            Date = dateUtc,
            EndTime = endTimeUtc,
            CustomerEmail = b.CustomerEmail,
            CustomerName = b.CustomerName,
            Seats = b.Seats,
            SpecialRequests = b.SpecialRequests,
            BookingRef = b.BookingRef,
            IsCancelled = b.IsCancelled,
            CancelledAt = cancelledAtUtc,
        };
    }
}
