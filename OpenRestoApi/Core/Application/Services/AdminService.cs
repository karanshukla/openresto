using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
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

        // Calculate Occupancy Data (Last 7 days) — raw counts first, then normalize to 0-100
        // relative to the peak day so the busiest day fills the chart and others are proportional.
        List<int> rawCounts = [];
        for (int i = 6; i >= 0; i--)
        {
            DateTime dayStart = DateTime.SpecifyKind(nowUtc.Date.AddDays(-i), DateTimeKind.Utc);
            DateTime dayEnd = dayStart.AddDays(1);
            int dayBookings = await _bookingRepository.CountActiveByDayAsync(dayStart, dayEnd);
            rawCounts.Add(dayBookings);
        }

        int maxCount = rawCounts.Count > 0 ? rawCounts.Max() : 0;
        List<int> occupancyData = rawCounts
            .Select(count => maxCount > 0 ? (int)Math.Round((double)count / maxCount * 100) : 0)
            .ToList();

        return new AdminOverviewDto
        {
            TotalRestaurants = totalRestaurants,
            TotalBookings = totalBookings,
            TodayBookings = todayBookingsCount,
            TotalSeats = totalSeats,
            ActiveHoldsCount = _holdService.GetActiveHoldsCount(),
            PausedRestaurantsCount = pausedRestaurantsCount,
            OccupancyData = occupancyData,
            TodayBookingsList = [.. todayBookingsList.OrderBy(b => b.Date)],
        };
    }

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

        // Normalize date: if Unspecified, treat as restaurant local and convert to UTC
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
            BookingRef = BookingRefGenerator.Generate(),
        };

        await _bookingRepository.AddAsync(booking);

        // Reload via the eager-loading GetByIdAsync to populate names and ensure UTC consistency.
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

        // Use EndTime if it's valid (after Date), otherwise fall back to the
        // restaurant's configured booking duration.
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

        // Validate restaurant exists if changing
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

        // Validate table exists and belongs to the (possibly new) restaurant
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

        // Update other fields
        if (req.Date.HasValue && req.Date.Value != booking.Date)
        {
            // If date changed, we should also shift EndTime by the same amount to keep duration
            if (booking.EndTime.HasValue)
            {
                TimeSpan duration = booking.EndTime.Value - booking.Date;
                booking.EndTime = req.Date.Value + duration;
            }
            else
            {
                // Default to the restaurant's configured booking duration if EndTime was missing for some reason
                booking.EndTime = req.Date.Value.AddMinutes(durationMinutes);
            }
            booking.Date = req.Date.Value;
        }

        // Final safety check: EndTime should never be before Date
        if (booking.EndTime.HasValue && booking.EndTime.Value < booking.Date)
        {
            booking.EndTime = booking.Date.AddMinutes(durationMinutes);
        }

        // --- CONFLICT CHECK ---
        // If either the Date or Table changed, verify that the new slot doesn't conflict with existing bookings
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

        // Reload via the eager-loading GetByIdAsync to get updated names.
        Booking? reloaded = await _bookingRepository.GetByIdAsync(id);
        return reloaded == null ? ToDetailDto(booking) : ToDetailDto(reloaded);
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

        // Active bookings are those that are currently in progress and not cancelled
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

    public virtual async Task<bool> DeleteRestaurantAsync(int id)
    {
        Restaurant? restaurant = await _restaurantRepository.FindByIdAsync(id);
        if (restaurant == null)
        {
            return false;
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
        // Force UTC kind to ensure JSON serializer adds the 'Z' suffix
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

        return new BookingDetailDto
        {
            Id = b.Id,
            RestaurantId = b.RestaurantId,
            RestaurantName = b.Restaurant?.Name,
            SectionId = b.SectionId,
            SectionName = b.Section?.Name ?? (b.SectionId.HasValue ? $"Section {b.SectionId}" : "Section"),
            TableId = b.TableId,
            TableName = b.Table?.Name ?? (b.TableId.HasValue ? $"Table {b.TableId}" : "Table"),
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
