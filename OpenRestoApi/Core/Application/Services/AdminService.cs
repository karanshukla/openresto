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
    INotificationQueue? notificationQueue = null,
    IAuditScope? audit = null)
{
    /// <summary>
    /// Castle's generated proxy constructors drop default values, so a Moq class mock reaches only
    /// a constructor of exactly matching arity. This is that constructor.
    /// </summary>
    public AdminService(
        IBookingRepository bookings,
        IBookingFilterRepository bookingFilters,
        IRestaurantRepository restaurants,
        ISectionRepository sections,
        ITableRepository tables,
        IHoldService holds,
        IEmailService email,
        BrandService? brand,
        INotificationQueue? notifications)
        : this(bookings, bookingFilters, restaurants, sections, tables, holds, email, brand,
            notifications, null)
    { }

    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;
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
        int scheduleConflictsCount = 0;
        List<int> scheduleConflictLocationIds = [];
        List<BookingDetailDto> todayBookingsList = [];
        foreach (Restaurant? r in restaurants)
        {
            (DateTime start, DateTime end) = TimeZoneHelper.GetUtcRangeForLocalDay(nowUtc, r.Timezone);
            List<Booking> rTodayBookings = await _bookingRepository.GetForRestaurantInUtcRangeAsync(r.Id, start, end);
            todayBookingsCount += rTodayBookings.Count;
            todayBookingsList.AddRange(rTodayBookings.Select(ToDetailDto));

            List<Booking> upcoming = await _bookingRepository.GetFutureForRestaurantAsync(r.Id, nowUtc);
            int rScheduleConflicts = ScheduleConflictHelper.Conflicting(r, upcoming).Count;
            if (rScheduleConflicts > 0)
            {
                scheduleConflictsCount += rScheduleConflicts;
                scheduleConflictLocationIds.Add(r.Id);
            }

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
            ScheduleConflictsCount = scheduleConflictsCount,
            ScheduleConflictLocationIds = scheduleConflictLocationIds,
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

    public virtual async Task<List<BookingDetailDto>> GetBookingsAsync(int? restaurantId, DateTime? bookingDate, string status, string? email = null, string? bookingRef = null, string? query = null)
    {
        List<Booking> bookings = await _bookingFilterRepository.QueryAsync(new BookingFilter
        {
            RestaurantId = restaurantId,
            BookingDate = bookingDate,
            Status = status,
            Email = email,
            BookingRef = bookingRef,
            Query = query,
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

        DescribeBooking(AuditActions.BookingCreate, booking,
            $"Created booking {booking.BookingRef} for {booking.Seats} guests");
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

        DateTime? previousEnd = booking.EndTime;
        booking.EndTime = from.AddMinutes(minutes);
        await _bookingRepository.UpdateAsync(booking);

        _audit.RecordChange("endTime", previousEnd, booking.EndTime);
        DescribeBooking(AuditActions.BookingExtend, booking,
            $"Extended booking {booking.BookingRef} by {minutes} minutes");
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

        DescribeBooking(AuditActions.BookingCancel, booking,
            $"Cancelled booking {booking.BookingRef}");
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

        DescribeBooking(AuditActions.BookingPurge, booking,
            $"Permanently deleted booking {booking.BookingRef}");
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

        DescribeBooking(AuditActions.BookingRestore, booking,
            $"Restored cancelled booking {booking.BookingRef}");
        return ToDetailDto(booking);
    }

    public virtual async Task<BookingDetailDto?> AdminUpdateBookingAsync(int id, AdminUpdateBookingRequest req)
    {
        Booking? booking = await _bookingRepository.GetByIdAsync(id);

        if (booking == null)
        {
            return null;
        }

        BookingFields before = BookingFields.From(booking);

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

        await RejectIfMovedOntoATakenUnitAsync(booking, before, id, durationMinutes);

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

        RecordBookingChanges(before, BookingFields.From(booking));
        DescribeBooking(AuditActions.BookingUpdate, booking, $"Updated booking {booking.BookingRef}");

        // Reloaded through the eager-loading read so the DTO carries the updated names.
        Booking? reloaded = await _bookingRepository.GetByIdAsync(id);
        return reloaded == null ? ToDetailDto(booking) : ToDetailDto(reloaded);
    }

    /// <summary>
    /// The booking fields an admin edit can move, snapshotted either side of the update.
    /// <see cref="Booking.SpecialRequests"/> is deliberately absent: it is guest-authored free text
    /// that routinely names people, and unlike a named field there is nothing masking it on the way
    /// into the entry.
    /// <seealso>AuditTrailTests.NoGuestDetailOnABooking_EverReachesTheTrail</seealso>
    /// </summary>
    private sealed record BookingFields(
        int RestaurantId,
        int? TableId,
        int? SectionId,
        DateTime Date,
        DateTime? EndTime,
        int Seats,
        string? CustomerEmail,
        string? CustomerName)
    {
        public static BookingFields From(Booking b) => new(
            b.RestaurantId, b.TableId, b.SectionId, b.Date, b.EndTime, b.Seats,
            b.CustomerEmail, b.CustomerName);
    }

    private void RecordBookingChanges(BookingFields before, BookingFields after)
    {
        _audit.RecordChange("restaurantId", before.RestaurantId, after.RestaurantId);
        _audit.RecordChange("tableId", before.TableId, after.TableId);
        _audit.RecordChange("sectionId", before.SectionId, after.SectionId);
        _audit.RecordChange("date", before.Date, after.Date);
        _audit.RecordChange("endTime", before.EndTime, after.EndTime);
        _audit.RecordChange("seats", before.Seats, after.Seats);
        // Recordable only because both sides mask to the redaction marker: the entry says the
        // guest's details were edited without restating them.
        _audit.RecordChange("customerEmail", before.CustomerEmail, after.CustomerEmail);
        _audit.RecordChange("customerName", before.CustomerName, after.CustomerName);
    }

    private void DescribeBooking(string action, Booking booking, string summary)
        => DescribeBooking(action, booking.Id, booking.BookingRef, booking.RestaurantId, summary);

    private void DescribeBooking(string action, BookingDetailDto booking, string summary)
        => DescribeBooking(action, booking.Id, booking.BookingRef, booking.RestaurantId, summary);

    /// <summary>
    /// Every booking entry goes through here, which is what keeps them all pointing at a booking
    /// by id and reference rather than by the guest sitting at it — the summaries above name the
    /// reference for the same reason. Booking history is deliberately GDPR-purgeable, and an entry
    /// carrying a guest's name, address, note or the body of a mail sent to them would outlive the
    /// purge that was supposed to remove it.
    /// <seealso>AuditTrailTests.BookingEntry_PointsAtTheBookingByItsReference</seealso>
    /// <seealso>AuditTrailTests.NoGuestDetailOnABooking_EverReachesTheTrail</seealso>
    /// </summary>
    private void DescribeBooking(string action, int id, string? bookingRef, int restaurantId, string summary)
        => _audit.Describe(action, AuditTargets.Booking, AuditTargets.IdOf(id), bookingRef, restaurantId, summary);

    private void DescribeRestaurant(string action, Restaurant restaurant, string summary)
        => _audit.Describe(action, AuditTargets.Restaurant, AuditTargets.IdOf(restaurant.Id),
            restaurant.Name, restaurant.Id, summary);

    /// <summary>Moves the sitting while keeping its length, so a reschedule never silently resizes it.</summary>
    private static void RescheduleKeepingDuration(Booking booking, DateTime newDate, int fallbackDurationMinutes)
    {
        booking.EndTime = booking.EndTime.HasValue
            ? newDate + (booking.EndTime.Value - booking.Date)
            : newDate.AddMinutes(fallbackDurationMinutes);
        booking.Date = newDate;
    }

    /// <summary>
    /// Rejects an edit that would put this booking on furniture someone else already has. Editing
    /// is how a booking is moved — there is no separate reschedule flow — so this is the only
    /// thing standing between an admin changing a date and the same table being seated twice.
    /// <para>
    /// Compares against <paramref name="before"/> rather than the request, because the caller has
    /// already written the request onto <paramref name="booking"/>: asking whether the request
    /// differs from the booking is asking whether a value differs from itself, which is what left
    /// this check unreachable for its whole life. Asking whether the booking moved is the question
    /// that survives the caller changing.
    /// </para>
    /// </summary>
    /// <seealso>AdminServiceTests.AdminUpdateBookingAsync_RejectsAMoveOntoATableAlreadyBookedThen</seealso>
    /// <seealso>AdminServiceTests.AdminUpdateBookingAsync_AllowsAMoveOntoAFreeSlotOnTheSameTable</seealso>
    private async Task RejectIfMovedOntoATakenUnitAsync(Booking booking, BookingFields before, int id, int durationMinutes)
    {
        bool moved = booking.Date != before.Date || booking.TableId != before.TableId;
        if (!moved)
        {
            return;
        }

        // The unit the booking actually occupies, not the one the request named: a group booking
        // carries TableId = null, and a table-only check would miss every group on the floor.
        bool taken = await _bookingRepository.IsUnitBookedOnDateAsync(
            booking.TableId,
            booking.TableGroupId,
            AsUtc(booking.Date),
            OccupancyMinutes(booking, durationMinutes),
            excludeBookingId: id);

        if (taken)
        {
            throw new BusinessRuleException("This update would cause a conflict with an existing booking.");
        }
    }

    /// <summary>How long the booking holds its unit: its own span when it has one, else the default.</summary>
    private static int OccupancyMinutes(Booking booking, int fallbackMinutes)
    {
        if (!booking.EndTime.HasValue)
        {
            return fallbackMinutes;
        }

        int span = (int)(booking.EndTime.Value - booking.Date).TotalMinutes;
        return span > 0 ? span : fallbackMinutes;
    }

    /// <summary>
    /// A stored <see cref="DateTime"/> as UTC. Everything is persisted UTC, so an Unspecified
    /// kind is already UTC and must be labelled rather than converted —
    /// <see cref="DateTime.ToUniversalTime"/> would read it as server-local and shift it.
    /// </summary>
    private static DateTime AsUtc(DateTime value)
        => value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

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
        bool? reordered = await _sectionRepository.ReorderAsync(restaurantId, sectionIds);
        if (reordered == true)
        {
            _audit.Describe(AuditActions.RestaurantReorderSections, AuditTargets.Restaurant,
                AuditTargets.IdOf(restaurantId), restaurantId: restaurantId,
                summary: $"Reordered {sectionIds.Count} sections");
        }

        return reordered;
    }

    // ── Restaurants ─────────────────────────────────────────────────────────

    public virtual async Task<bool> PauseRestaurantBookingsAsync(int restaurantId, int durationMinutes)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        DateTime? previousPausedUntil = restaurant.BookingsPausedUntil;
        restaurant.BookingsPausedUntil = DateTime.UtcNow.AddMinutes(durationMinutes);
        await _restaurantRepository.SaveChangesAsync();

        _audit.RecordChange("bookingsPausedUntil", previousPausedUntil, restaurant.BookingsPausedUntil);
        DescribeRestaurant(AuditActions.RestaurantPause, restaurant,
            $"Paused bookings at {restaurant.Name} for {durationMinutes} minutes");
        return true;
    }

    public virtual async Task<bool> UnpauseRestaurantBookingsAsync(int restaurantId)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (restaurant == null)
        {
            return false;
        }

        DateTime? previousPausedUntil = restaurant.BookingsPausedUntil;
        restaurant.BookingsPausedUntil = null;
        await _restaurantRepository.SaveChangesAsync();

        _audit.RecordChange("bookingsPausedUntil", previousPausedUntil, null);
        DescribeRestaurant(AuditActions.RestaurantUnpause, restaurant,
            $"Resumed bookings at {restaurant.Name}");
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

        DescribeRestaurant(AuditActions.RestaurantExtendBookings, restaurant,
            $"Extended {activeBookings.Count} in-progress bookings at {restaurant.Name} by {extensionMinutes} minutes");
        return activeBookings.Select(ToDetailDto).ToList();
    }

    public virtual async Task<RestaurantDto> CreateRestaurantAsync(string name, string? address)
    {
        var restaurant = new Restaurant { Name = name.Trim(), Address = address?.Trim() };
        await _restaurantRepository.AddAsync(restaurant);

        DescribeRestaurant(AuditActions.RestaurantCreate, restaurant,
            $"Created the location \"{restaurant.Name}\"");

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

        _audit.RecordChange("isArchived", restaurant.IsArchived, archived);
        restaurant.IsArchived = archived;
        await _restaurantRepository.SaveChangesAsync();

        DescribeRestaurant(
            archived ? AuditActions.RestaurantArchive : AuditActions.RestaurantRestore,
            restaurant,
            archived
                ? $"Archived the location \"{restaurant.Name}\""
                : $"Restored the location \"{restaurant.Name}\"");
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

        DescribeRestaurant(AuditActions.RestaurantDelete, restaurant,
            $"Permanently deleted the location \"{restaurant.Name}\" and its {bookings.Count} bookings");
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

        DescribeBooking(AuditActions.BookingEmail, booking,
            $"Emailed the guest on booking {booking.BookingRef}");
        return SendBookingEmailResult.Sent(booking.CustomerEmail);
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static BookingDetailDto ToDetailDto(Booking b)
    {
        DateTime dateUtc = AsUtc(b.Date);
        DateTime? endTimeUtc = b.EndTime.HasValue ? AsUtc(b.EndTime.Value) : null;
        DateTime? cancelledAtUtc = b.CancelledAt.HasValue ? AsUtc(b.CancelledAt.Value) : null;

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
            Timezone = b.Restaurant?.Timezone,
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
