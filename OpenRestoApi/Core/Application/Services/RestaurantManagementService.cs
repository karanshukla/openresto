using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Mappings;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

public class RestaurantManagementService(
    IRestaurantRepository restaurantRepository,
    ISectionRepository sectionRepository,
    ITableRepository tableRepository,
    IBookingRepository bookingRepository,
    ITableGroupRepository tableGroupRepository,
    IAuditScope? audit = null)
{
    private readonly IRestaurantRepository _restaurantRepository = restaurantRepository;
    private readonly ISectionRepository _sectionRepository = sectionRepository;
    private readonly ITableRepository _tableRepository = tableRepository;
    private readonly IBookingRepository _bookingRepository = bookingRepository;
    private readonly ITableGroupRepository _tableGroupRepository = tableGroupRepository;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    private static readonly HashSet<int> _allowedBookingDurationsMinutes =
        [30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

    // Allowed start-time interval values — kept small and sane so the availability
    // slot-generation loop can't be sent into a degenerate (e.g. 0 or negative) spin.
    private static readonly HashSet<int> _allowedBookingSlotIntervalsMinutes = [15, 30, 60];

    /// <summary>
    /// Resolves the wire-format string ("AlphaNumeric"/"Numeric", case-insensitive) to the enum.
    /// Rejects the numeric spellings <see cref="Enum.TryParse{TEnum}(string, bool, out TEnum)"/>
    /// accepts by default ("1", "7"), so the API contract stays the member names only.
    /// </summary>
    private static BookingRefFormat ParseBookingRefFormat(string value)
    {
        if (!Enum.TryParse(value, ignoreCase: true, out BookingRefFormat parsed)
            || !Enum.IsDefined(parsed)
            || char.IsDigit(value.Trim().FirstOrDefault()))
        {
            throw new ValidationException(
                $"BookingRefFormat must be one of: {string.Join(", ", Enum.GetNames<BookingRefFormat>())}.");
        }

        return parsed;
    }

    // ── Restaurants ─────────────────────────────────────────────────────────

    public async Task<List<RestaurantDto>> GetAllAsync()
    {
        List<Restaurant> restaurants = await _restaurantRepository.GetAllActiveWithSectionsAsync();
        return restaurants.Select(ToDto).ToList();
    }

    public async Task<RestaurantDto?> GetByIdAsync(int id)
    {
        Restaurant? r = await _restaurantRepository.GetByIdAsync(id);
        return r == null ? null : ToDto(r);
    }

    public async Task<RestaurantDto> CreateAsync(RestaurantDto dto)
    {
        var entity = new Restaurant
        {
            Name = dto.Name,
            Address = dto.Address,
            OpenTime = string.IsNullOrWhiteSpace(dto.OpenTime) ? OpeningHourDefaults.Open : dto.OpenTime,
            CloseTime = string.IsNullOrWhiteSpace(dto.CloseTime) ? OpeningHourDefaults.Close : dto.CloseTime,
            OpenDays = string.IsNullOrWhiteSpace(dto.OpenDays) ? "1,2,3,4,5,6,7" : dto.OpenDays,
            Timezone = string.IsNullOrWhiteSpace(dto.Timezone) ? "UTC" : dto.Timezone,
            PhoneNumber = dto.PhoneNumber == null ? null : ContactFields.NormalizePhone(dto.PhoneNumber),
            EmailAddress = dto.EmailAddress == null ? null : ContactFields.NormalizeEmail(dto.EmailAddress),
            DefaultBookingDurationMinutes = dto.DefaultBookingDurationMinutes,
            BookingSlotIntervalMinutes = dto.BookingSlotIntervalMinutes,
            MaxTableOversizeSeats = dto.MaxTableOversizeSeats,
            BookingRefFormat = string.IsNullOrWhiteSpace(dto.BookingRefFormat)
                ? BookingRefFormat.AlphaNumeric
                : ParseBookingRefFormat(dto.BookingRefFormat),
            Sections = dto.Sections.Select((s, index) => new Section
            {
                Name = s.Name,
                SortOrder = index,
                Tables = s.Tables.Select(t => new Table { Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList()
        };

        // After the entity is populated, so ApplyOpenHours can collapse identical days back
        // into OpenTime/CloseTime rather than storing redundant JSON.
        if (dto.OpenHours is { Count: > 0 })
        {
            OpeningHoursHelper.ApplyOpenHours(entity, dto.OpenHours);
        }

        await _restaurantRepository.AddAsync(entity);

        DescribeRestaurant(AuditActions.RestaurantCreate, entity,
            $"Created the location \"{entity.Name}\"");
        return ToDto(entity);
    }

    public async Task<RestaurantDto?> UpdateAsync(int id, UpdateRestaurantRequest req)
    {
        Restaurant? r = await _restaurantRepository.FindByIdAsync(id);
        if (r == null)
        {
            return null;
        }

        RestaurantFields before = RestaurantFields.From(r);

        r.Name = req.Name;
        r.Address = req.Address;
        if (req.Description != null)
        {
            r.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        }
        if (req.MenuUrl != null)
        {
            // Blank clears (matching the brand-text whitespace-to-null convention); a non-blank
            // value must be either an absolute http(s) URL (an externally hosted menu) or the
            // instance-served "/media/menu-<id>.pdf" path written by MediaService.UploadMenuAsync.
            // The served path is relative and intentionally bypasses UrlValidator (which only
            // accepts absolute URLs); rejecting it would break the upload flow.
            if (string.IsNullOrWhiteSpace(req.MenuUrl))
            {
                r.MenuUrl = null;
            }
            else
            {
                string trimmed = req.MenuUrl.Trim();
                bool isServedMenuFile = trimmed.StartsWith("/media/", StringComparison.OrdinalIgnoreCase);
                if (!isServedMenuFile && !UrlValidator.IsValid(trimmed, UrlValidator.WebSchemes))
                {
                    throw new ValidationException(
                        "Menu URL must be a valid absolute http(s) URL.");
                }
                r.MenuUrl = trimmed;
            }
        }
        if (req.PhoneNumber != null)
        {
            r.PhoneNumber = ContactFields.NormalizePhone(req.PhoneNumber);
        }
        if (req.EmailAddress != null)
        {
            r.EmailAddress = ContactFields.NormalizeEmail(req.EmailAddress);
        }
        if (req.OpenTime != null)
        {
            r.OpenTime = req.OpenTime;
        }

        if (req.CloseTime != null)
        {
            r.CloseTime = req.CloseTime;
        }

        if (req.OpenDays != null)
        {
            r.OpenDays = req.OpenDays;
        }

        if (req.OpenHours != null)
        {
            OpeningHoursHelper.ApplyOpenHours(r, req.OpenHours);
        }

        if (req.Timezone != null)
        {
            r.Timezone = req.Timezone;
        }

        if (req.Tags != null)
        {
            r.Tags = req.Tags;
        }

        if (req.DefaultBookingDurationMinutes.HasValue)
        {
            if (!_allowedBookingDurationsMinutes.Contains(req.DefaultBookingDurationMinutes.Value))
            {
                throw new ValidationException(
                    $"DefaultBookingDurationMinutes must be one of: {string.Join(", ", _allowedBookingDurationsMinutes.Order())}.");
            }

            r.DefaultBookingDurationMinutes = req.DefaultBookingDurationMinutes.Value;
        }

        if (req.BookingSlotIntervalMinutes.HasValue)
        {
            if (!_allowedBookingSlotIntervalsMinutes.Contains(req.BookingSlotIntervalMinutes.Value))
            {
                throw new ValidationException(
                    $"BookingSlotIntervalMinutes must be one of: {string.Join(", ", _allowedBookingSlotIntervalsMinutes.Order())}.");
            }

            r.BookingSlotIntervalMinutes = req.BookingSlotIntervalMinutes.Value;
        }

        // Assigned unconditionally: null means "off", and the settings form always sends the
        // field, so a conditional write would make selecting "Off" unable to clear a set cap.
        if (req.MaxTableOversizeSeats.HasValue && req.MaxTableOversizeSeats.Value < 0)
        {
            throw new ValidationException("MaxTableOversizeSeats must be zero or greater, or null to disable.");
        }

        r.MaxTableOversizeSeats = req.MaxTableOversizeSeats;

        if (req.BookingRefFormat != null)
        {
            r.BookingRefFormat = ParseBookingRefFormat(req.BookingRefFormat);
        }

        if (req.WalkInOnly.HasValue)
        {
            r.WalkInOnly = req.WalkInOnly.Value;
        }

        if (req.WalkInDays != null)
        {
            r.WalkInDays = WalkInHelper.NormalizeWalkInDays(req.WalkInDays);
        }

        await _restaurantRepository.SaveChangesAsync();

        RecordRestaurantChanges(before, RestaurantFields.From(r));
        DescribeRestaurant(AuditActions.RestaurantUpdate, r, $"Updated the location \"{r.Name}\"");

        return new RestaurantDto
        {
            Id = r.Id,
            Name = r.Name,
            Address = r.Address,
            OpenTime = r.OpenTime,
            CloseTime = r.CloseTime,
            OpenHours = OpeningHoursHelper.ResolveWeek(r),
            OpenDays = r.OpenDays,
            Timezone = r.Timezone,
            Tags = string.IsNullOrEmpty(r.Tags)
                ? []
                : r.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            ImageUrl = r.ImageUrl,
            Description = r.Description,
            MenuUrl = r.MenuUrl,
            PhoneNumber = r.PhoneNumber,
            EmailAddress = r.EmailAddress,
            WalkInOnly = r.WalkInOnly,
            WalkInDays = r.WalkInDays ?? "",
            DefaultBookingDurationMinutes = r.DefaultBookingDurationMinutes,
            BookingSlotIntervalMinutes = r.BookingSlotIntervalMinutes,
            MaxTableOversizeSeats = r.MaxTableOversizeSeats,
            BookingRefFormat = r.BookingRefFormat.ToString(),
            Sections = []
        };
    }

    /// <summary>The location settings an admin edit can move, snapshotted either side of the save.</summary>
    private sealed record RestaurantFields(
        string Name,
        string? Address,
        string? Description,
        string? MenuUrl,
        string? PhoneNumber,
        string? EmailAddress,
        string OpenTime,
        string CloseTime,
        string? OpenHoursJson,
        string OpenDays,
        string Timezone,
        string? Tags,
        int DefaultBookingDurationMinutes,
        int BookingSlotIntervalMinutes,
        int? MaxTableOversizeSeats,
        BookingRefFormat BookingRefFormat,
        bool WalkInOnly,
        string? WalkInDays)
    {
        public static RestaurantFields From(Restaurant r) => new(
            r.Name, r.Address, r.Description, r.MenuUrl, r.PhoneNumber, r.EmailAddress, r.OpenTime,
            r.CloseTime, r.OpenHoursJson, r.OpenDays, r.Timezone, r.Tags,
            r.DefaultBookingDurationMinutes, r.BookingSlotIntervalMinutes, r.MaxTableOversizeSeats,
            r.BookingRefFormat, r.WalkInOnly, r.WalkInDays);
    }

    private void RecordRestaurantChanges(RestaurantFields before, RestaurantFields after)
    {
        _audit.RecordChange("name", before.Name, after.Name);
        _audit.RecordChange("address", before.Address, after.Address);
        _audit.RecordChange("description", before.Description, after.Description);
        _audit.RecordChange("menuUrl", before.MenuUrl, after.MenuUrl);
        _audit.RecordChange("phoneNumber", before.PhoneNumber, after.PhoneNumber);
        _audit.RecordChange("emailAddress", before.EmailAddress, after.EmailAddress);
        _audit.RecordChange("openTime", before.OpenTime, after.OpenTime);
        _audit.RecordChange("closeTime", before.CloseTime, after.CloseTime);
        _audit.RecordChange("openHours", before.OpenHoursJson, after.OpenHoursJson);
        _audit.RecordChange("openDays", before.OpenDays, after.OpenDays);
        _audit.RecordChange("timezone", before.Timezone, after.Timezone);
        _audit.RecordChange("tags", before.Tags, after.Tags);
        _audit.RecordChange("defaultBookingDurationMinutes",
            before.DefaultBookingDurationMinutes, after.DefaultBookingDurationMinutes);
        _audit.RecordChange("bookingSlotIntervalMinutes",
            before.BookingSlotIntervalMinutes, after.BookingSlotIntervalMinutes);
        _audit.RecordChange("maxTableOversizeSeats",
            before.MaxTableOversizeSeats, after.MaxTableOversizeSeats);
        _audit.RecordChange("bookingRefFormat", before.BookingRefFormat, after.BookingRefFormat);
        _audit.RecordChange("walkInOnly", before.WalkInOnly, after.WalkInOnly);
        _audit.RecordChange("walkInDays", before.WalkInDays, after.WalkInDays);
    }

    private void DescribeRestaurant(string action, Restaurant restaurant, string summary)
        => _audit.Describe(action, AuditTargets.Restaurant, AuditTargets.IdOf(restaurant.Id),
            restaurant.Name, restaurant.Id, summary);

    // ── Sections ────────────────────────────────────────────────────────────

    public async Task<SectionDto?> AddSectionAsync(int restaurantId, string name)
    {
        Restaurant? r = await _restaurantRepository.FindByIdAsync(restaurantId);
        if (r == null)
        {
            return null;
        }

        int nextSortOrder = await _sectionRepository.CountByRestaurantAsync(restaurantId);
        var section = new Section { Name = name, RestaurantId = restaurantId, SortOrder = nextSortOrder };
        await _sectionRepository.AddAsync(section);

        DescribeSection(AuditActions.SectionCreate, section, restaurantId,
            $"Added the section \"{section.Name}\" to {r.Name}");
        return new SectionDto { Id = section.Id, Name = section.Name, SortOrder = section.SortOrder, Tables = [] };
    }

    public async Task<SectionDto?> UpdateSectionAsync(int restaurantId, int sectionId, string name)
    {
        Section? section = await _sectionRepository.FindForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return null;
        }

        _audit.RecordChange("name", section.Name, name);
        section.Name = name;
        await _sectionRepository.SaveChangesAsync();

        DescribeSection(AuditActions.SectionUpdate, section, restaurantId,
            $"Renamed a section to \"{section.Name}\"");
        return new SectionDto { Id = section.Id, Name = section.Name, SortOrder = section.SortOrder, Tables = [] };
    }

    public async Task<bool> DeleteSectionAsync(int restaurantId, int sectionId)
    {
        Section? section = await _sectionRepository.GetWithTablesForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return false;
        }

        // FK-nulled before the section goes: bookings outlive the section they were seated in.
        var tableIds = section.Tables.Select(t => t.Id).ToList();
        List<Booking> affected = await _bookingRepository.GetBySectionOrTablesAsync(sectionId, tableIds);
        foreach (Booking b in affected)
        {
            b.TableId = null;
            b.SectionId = null;
        }

        // Every table in the section goes with it, so any combinable group that spans one of them
        // must be dissolved or shrunk first (see ReconcileTableGroupsAsync).
        await ReconcileTableGroupsAsync(restaurantId, tableIds);

        _sectionRepository.Remove(section);
        await _sectionRepository.SaveChangesAsync();

        DescribeSection(AuditActions.SectionDelete, section, restaurantId,
            $"Deleted the section \"{section.Name}\" and its {tableIds.Count} tables");
        return true;
    }

    private void DescribeSection(string action, Section section, int restaurantId, string summary)
        => _audit.Describe(action, AuditTargets.Section, AuditTargets.IdOf(section.Id), section.Name,
            restaurantId, summary);

    // ── Tables ──────────────────────────────────────────────────────────────

    public async Task<TableDto?> AddTableAsync(int restaurantId, int sectionId, string? name, int seats)
    {
        Section? section = await _sectionRepository.FindForRestaurantAsync(sectionId, restaurantId);

        if (section == null)
        {
            return null;
        }

        ValidateSeats(seats);

        var table = new Table { Name = name, Seats = seats, SectionId = sectionId };
        await _tableRepository.AddAsync(table);

        DescribeTable(AuditActions.TableCreate, table, restaurantId,
            $"Added {TableLabel(table)} ({seats} seats) to \"{section.Name}\"");
        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    public async Task<TableDto?> UpdateTableAsync(int restaurantId, int sectionId, int tableId, string? name, int seats)
    {
        Table? table = await _tableRepository.GetForRestaurantAsync(tableId, sectionId, restaurantId);

        if (table == null)
        {
            return null;
        }

        ValidateSeats(seats);

        _audit.RecordChange("name", table.Name, name);
        _audit.RecordChange("seats", table.Seats, seats);

        table.Name = name;
        table.Seats = seats;
        await _tableRepository.SaveChangesAsync();

        // After the save, so the reconcile reads the new capacity rather than the pre-edit one.
        await ReconcileTableGroupsAsync(restaurantId, Array.Empty<int>());
        await _tableRepository.SaveChangesAsync();

        DescribeTable(AuditActions.TableUpdate, table, restaurantId,
            $"Updated {TableLabel(table)} ({table.Seats} seats)");
        return new TableDto { Id = table.Id, Name = table.Name, Seats = table.Seats };
    }

    /// <summary>
    /// Restores the invariants a combinable group must satisfy after its member tables changed
    /// underneath it — a member deleted (the DB cascade drops the membership row silently) or
    /// resized. A group left with fewer than two members is dissolved, FK-nulling its bookings first
    /// exactly like <see cref="DeleteTableGroupAsync"/>; a surviving group has its stored
    /// <see cref="TableGroup.CombinedSeats"/> clamped back into the range
    /// <see cref="ValidateCombinedSeats"/> enforces on write. Without this a group keeps advertising
    /// combined capacity that no longer exists — tables 8+9 still offered as 8 seats after table 9 is
    /// deleted or shrunk, and the booking engine would happily seat a party of 8 at one 4-top.
    /// Does not save: the caller's SaveChangesAsync flushes this in the same unit of work.
    /// </summary>
    private async Task ReconcileTableGroupsAsync(int restaurantId, IReadOnlyCollection<int> removedTableIds)
    {
        List<TableGroup> groups = await _tableGroupRepository.GetAllWithMembersByRestaurantAsync(restaurantId);

        foreach (TableGroup group in groups)
        {
            List<TableGroupMembership> remaining = group.Members
                .Where(m => !removedTableIds.Contains(m.TableId))
                .ToList();

            if (remaining.Count < 2)
            {
                foreach (Booking booking in await _bookingRepository.GetByTableGroupAsync(group.Id))
                {
                    booking.TableGroupId = null;
                }

                _tableGroupRepository.Remove(group);
                continue;
            }

            group.Members = remaining;

            var memberSeats = remaining.Select(m => m.Table?.Seats ?? 0).ToList();
            if (memberSeats.Any(s => s <= 0))
            {
                continue;
            }

            int floor = memberSeats.Max() + 1;
            int ceiling = Math.Min(memberSeats.Sum(), BookingLimits.MaxSeats);
            if (floor <= ceiling)
            {
                group.CombinedSeats = Math.Clamp(group.CombinedSeats, floor, ceiling);
            }
        }
    }

    /// <summary>
    /// Validates a table/group seating capacity. Defense in depth behind the DTO [Range] annotation
    /// — a direct service call (e.g. from a seeder or test) bypasses model binding, so this catches
    /// 0/negative/oversized values at the service boundary too.
    /// </summary>
    private static void ValidateSeats(int seats)
    {
        if (seats < BookingLimits.MinSeats || seats > BookingLimits.MaxSeats)
        {
            throw new ValidationException(
                $"Seats must be between {BookingLimits.MinSeats} and {BookingLimits.MaxSeats}.");
        }
    }

    /// <summary>
    /// Validates a combinable group's CombinedSeats: absolute bounds first, then the contextual
    /// window the member set implies. Split from <see cref="ValidateSeats"/> because that window
    /// depends on the resolved members. The ceiling is the sum of member seats — pushing tables
    /// together can only lose covers (a shared corner disappears), never invent them. The floor is
    /// one more than the largest member, since a group that seats no more than its biggest table on
    /// its own is not worth combining and would shadow that table in the candidate ordering.
    /// </summary>
    private static void ValidateCombinedSeats(int combinedSeats, IReadOnlyCollection<Table> members)
    {
        ValidateSeats(combinedSeats);

        int memberSeatsSum = members.Sum(t => t.Seats);
        if (combinedSeats > memberSeatsSum)
        {
            throw new ValidationException(
                $"CombinedSeats ({combinedSeats}) cannot exceed the sum of member seats ({memberSeatsSum}).");
        }

        int largestMemberSeats = members.Max(t => t.Seats);
        if (combinedSeats <= largestMemberSeats)
        {
            throw new ValidationException(
                $"CombinedSeats ({combinedSeats}) must be more than the largest member table ({largestMemberSeats}). "
                + "combining these tables would not seat a bigger party.");
        }
    }

    public async Task<bool> DeleteTableAsync(int restaurantId, int sectionId, int tableId)
    {
        Table? table = await _tableRepository.GetForRestaurantAsync(tableId, sectionId, restaurantId);

        if (table == null)
        {
            return false;
        }

        List<Booking> affected = await _bookingRepository.GetByTableAsync(tableId);
        foreach (Booking b in affected)
            b.TableId = null;

        // The membership row would be cascade-deleted silently, leaving a combinable group that
        // advertises capacity it can no longer seat. Reconcile before the table goes.
        await ReconcileTableGroupsAsync(restaurantId, new[] { tableId });

        _tableRepository.Remove(table);
        await _tableRepository.SaveChangesAsync();

        DescribeTable(AuditActions.TableDelete, table, restaurantId,
            $"Deleted {TableLabel(table)}, clearing it from {affected.Count} bookings");
        return true;
    }

    private void DescribeTable(string action, Table table, int restaurantId, string summary)
        => _audit.Describe(action, AuditTargets.Table, AuditTargets.IdOf(table.Id), TableLabel(table),
            restaurantId, summary);

    private static string TableLabel(Table table) => table.Name ?? $"Table {table.Id}";

    // ── Delete-impact reads (two-step delete friction, #270) ────────────────
    //
    // Cheap, best-effort previews of what a delete would orphan — used by the admin UI to show the
    // consequence ("N future bookings will lose their table reference") inside the inline confirm step.
    // Counts non-cancelled bookings starting at/after now; past + cancelled bookings are irrelevant to
    // the decision. Mirrors the ownership scoping of the deletes themselves so the count matches the
    // FK-null set the delete will actually touch. Returns null when the table/section doesn't exist
    // (or doesn't belong to the restaurant), so the UI can fall back to generic copy.

    public async Task<DeleteImpactDto?> GetTableDeleteImpactAsync(int restaurantId, int sectionId, int tableId)
    {
        Table? table = await _tableRepository.GetForRestaurantAsync(tableId, sectionId, restaurantId);
        if (table == null)
        {
            return null;
        }

        DateTime nowUtc = DateTime.UtcNow;
        int bookings = await _bookingRepository.CountFutureByTableAsync(tableId, nowUtc)
            + await CountFutureGroupBookingsForTablesAsync(restaurantId, new[] { tableId }, nowUtc);

        return new DeleteImpactDto { Bookings = bookings };
    }

    public async Task<DeleteImpactDto?> GetSectionDeleteImpactAsync(int restaurantId, int sectionId)
    {
        Section? section = await _sectionRepository.GetWithTablesForRestaurantAsync(sectionId, restaurantId);
        if (section == null)
        {
            return null;
        }

        DateTime nowUtc = DateTime.UtcNow;
        var tableIds = section.Tables.Select(t => t.Id).ToList();
        int bookings = await _bookingRepository.CountFutureBySectionOrTablesAsync(sectionId, tableIds, nowUtc)
            + await CountFutureGroupBookingsForTablesAsync(restaurantId, tableIds, nowUtc);

        return new DeleteImpactDto { Bookings = bookings };
    }

    /// <summary>
    /// Upcoming bookings that reserve <paramref name="tableIds"/> through a combinable group rather than
    /// directly. Those rows carry TableId = null, so the table/section impact counts miss them entirely and
    /// the admin's confirm step would claim a delete orphans nothing while a merged-table party is booked.
    /// </summary>
    private async Task<int> CountFutureGroupBookingsForTablesAsync(
        int restaurantId,
        IReadOnlyCollection<int> tableIds,
        DateTime nowUtc)
    {
        List<TableGroup> groups = await _tableGroupRepository.GetAllWithMembersByRestaurantAsync(restaurantId);
        var affectedGroupIds = groups
            .Where(g => g.Members.Any(m => tableIds.Contains(m.TableId)))
            .Select(g => g.Id)
            .ToList();

        return affectedGroupIds.Count == 0
            ? 0
            : await _bookingRepository.CountFutureByTableGroupsAsync(affectedGroupIds, nowUtc);
    }

    // ── Combinable table groups (#271) ─────────────────────────────────────
    //
    // A group is a first-class bookable unit made of physical tables pushed together. Members must
    // all belong to the same restaurant, no member may already be in another group, and the stored
    // CombinedSeats must sit between "more than the largest member" and "the sum of the members"
    // (pushing tables together commonly loses a cover where the corners meet). All rules are enforced
    // here in-service because the in-memory provider used by tests ignores SQL constraints; the
    // unique index on TableId is the production backstop.

    public async Task<TableGroupDto?> AddTableGroupAsync(int restaurantId, CreateTableGroupRequest req)
    {
        bool exists = await _restaurantRepository.ExistsAsync(restaurantId);
        if (!exists)
        {
            return null;
        }

        List<Table> members = await ResolveAndValidateMembersAsync(restaurantId, req.Members, excludeGroupId: null);

        // CombinedSeats must be within bounds and inside the window the member set implies.
        ValidateCombinedSeats(req.CombinedSeats, members);

        var group = new TableGroup
        {
            Name = req.Name,
            RestaurantId = restaurantId,
            CombinedSeats = req.CombinedSeats,
            Members = members.Select(t => new TableGroupMembership { TableId = t.Id, Table = t }).ToList()
        };

        await _tableGroupRepository.AddAsync(group);
        await _tableGroupRepository.SaveChangesAsync();

        DescribeTableGroup(AuditActions.TableGroupCreate, group,
            $"Made {BookingMapper.GroupLabel(group)} combinable, seating {group.CombinedSeats}");
        return ToGroupDto(group);
    }

    public async Task<TableGroupDto?> UpdateTableGroupAsync(int restaurantId, int groupId, UpdateTableGroupRequest req)
    {
        TableGroup? group = await _tableGroupRepository.GetByIdWithMembersAsync(groupId, restaurantId);
        if (group == null)
        {
            return null;
        }

        // Re-validate the new member set, allowing the group's own current members to stay.
        var currentMemberIds = group.Members.Select(m => m.TableId).ToHashSet();
        List<Table> members = await ResolveAndValidateMembersAsync(
            restaurantId, req.Members, excludeGroupId: groupId, currentMemberIds: currentMemberIds);

        ValidateCombinedSeats(req.CombinedSeats, members);

        _audit.RecordChange("name", group.Name, req.Name);
        _audit.RecordChange("combinedSeats", group.CombinedSeats, req.CombinedSeats);
        _audit.RecordChange("members", MemberIdList(currentMemberIds), MemberIdList(members.Select(t => t.Id)));

        group.Name = req.Name;
        group.CombinedSeats = req.CombinedSeats;
        // Replace the member set in place so EF tracks the add/remove diff and cascades correctly.
        group.Members = members.Select(t => new TableGroupMembership { TableGroupId = group.Id, TableId = t.Id, Table = t }).ToList();

        await _tableGroupRepository.SaveChangesAsync();

        DescribeTableGroup(AuditActions.TableGroupUpdate, group,
            $"Updated {BookingMapper.GroupLabel(group)}, seating {group.CombinedSeats}");
        return ToGroupDto(group);
    }

    public async Task<bool> DeleteTableGroupAsync(int restaurantId, int groupId)
    {
        TableGroup? group = await _tableGroupRepository.GetByIdWithMembersAsync(groupId, restaurantId);
        if (group == null)
        {
            return false;
        }

        // Bookings keep every other detail; only the group reference is cleared.
        List<Booking> affected = await _bookingRepository.GetByTableGroupAsync(groupId);
        foreach (Booking b in affected)
        {
            b.TableGroupId = null;
        }

        _tableGroupRepository.Remove(group);
        await _tableGroupRepository.SaveChangesAsync();

        DescribeTableGroup(AuditActions.TableGroupDelete, group,
            $"Split up {BookingMapper.GroupLabel(group)}, freeing {affected.Count} bookings from it");
        return true;
    }

    private void DescribeTableGroup(string action, TableGroup group, string summary)
        => _audit.Describe(action, AuditTargets.TableGroup, AuditTargets.IdOf(group.Id),
            BookingMapper.GroupLabel(group), group.RestaurantId, summary);

    private static string MemberIdList(IEnumerable<int> tableIds)
        => string.Join(",", tableIds.Order());

    /// <summary>
    /// Loads the requested member tables, scoped to the restaurant, and enforces every data-integrity
    /// rule: distinct ids, &gt;= 2 members, all exist + belong to this restaurant, and none already in
    /// another group (allowing a table to remain in the group being edited). Throws
    /// <see cref="ValidationException"/> on the first violation.
    /// </summary>
    private async Task<List<Table>> ResolveAndValidateMembersAsync(
        int restaurantId,
        IReadOnlyList<int> memberIds,
        int? excludeGroupId,
        HashSet<int>? currentMemberIds = null)
    {
        if (memberIds == null || memberIds.Count < 2)
        {
            throw new ValidationException("A combinable table group must have at least two members.");
        }

        if (memberIds.Distinct().Count() != memberIds.Count)
        {
            throw new ValidationException("A combinable table group cannot list the same table twice.");
        }

        // Load candidate members scoped to the restaurant via the section→restaurant chain.
        List<Table> tables = await _tableRepository.GetManyForRestaurantAsync(memberIds, restaurantId);
        if (tables.Count != memberIds.Count)
        {
            throw new ValidationException("All member tables must exist and belong to this restaurant.");
        }

        // Reject any member already claimed by a *different* group. A table in the group being edited
        // (currentMemberIds) is allowed to stay; everything else must be ungrouped.
        var grouped = await _tableGroupRepository.GetAllWithMembersByRestaurantAsync(restaurantId);
        var tableIdToGroup = new Dictionary<int, int>();
        foreach (TableGroup g in grouped)
        {
            if (excludeGroupId.HasValue && g.Id == excludeGroupId.Value) continue;
            foreach (TableGroupMembership m in g.Members)
            {
                tableIdToGroup[m.TableId] = g.Id;
            }
        }

        foreach (Table t in tables)
        {
            if (tableIdToGroup.TryGetValue(t.Id, out int ownerGroupId))
            {
                throw new ValidationException(
                    $"Table {t.Id} already belongs to another combinable group ({ownerGroupId}).");
            }
        }

        return tables;
    }

    private static TableGroupDto ToGroupDto(TableGroup g) => new()
    {
        Id = g.Id,
        Name = g.Name,
        CombinedSeats = g.CombinedSeats,
        Members = g.Members
            .OrderBy(m => m.TableId)
            .Select(m => m.Table ?? throw new InvalidOperationException(
                $"TableGroupMembership {m.TableGroupId}/{m.TableId} has no Table loaded."))
            .Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats })
            .ToList()
    };

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static RestaurantDto ToDto(Restaurant r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Address = r.Address,
        OpenTime = r.OpenTime,
        CloseTime = r.CloseTime,
        OpenHours = OpeningHoursHelper.ResolveWeek(r),
        OpenDays = r.OpenDays,
        Timezone = r.Timezone,
        Tags = string.IsNullOrEmpty(r.Tags)
            ? []
            : r.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        ImageUrl = r.ImageUrl,
        Description = r.Description,
        MenuUrl = r.MenuUrl,
        PhoneNumber = r.PhoneNumber,
        EmailAddress = r.EmailAddress,
        IsArchived = r.IsArchived,
        WalkInOnly = r.WalkInOnly,
        WalkInDays = r.WalkInDays ?? "",
        DefaultBookingDurationMinutes = r.DefaultBookingDurationMinutes,
        BookingSlotIntervalMinutes = r.BookingSlotIntervalMinutes,
        MaxTableOversizeSeats = r.MaxTableOversizeSeats,
        BookingRefFormat = r.BookingRefFormat.ToString(),
        Sections = r.Sections
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .Select(s => new SectionDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Tables = s.Tables.Select(t => new TableDto { Id = t.Id, Name = t.Name, Seats = t.Seats }).ToList()
            }).ToList(),
        Groups = (r.Groups ?? Enumerable.Empty<TableGroup>())
            .OrderBy(g => g.Id)
            .Select(g => new TableGroupDto
            {
                Id = g.Id,
                Name = g.Name,
                CombinedSeats = g.CombinedSeats,
                Members = (g.Members ?? Enumerable.Empty<TableGroupMembership>())
                    .OrderBy(m => m.TableId)
                    .Select(m => new TableDto { Id = m.Table!.Id, Name = m.Table.Name, Seats = m.Table.Seats })
                    .ToList()
            }).ToList()
    };
}
