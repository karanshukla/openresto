namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Stable, machine-readable identifiers for the specific rule that rejected a request. Surfaced
/// as <c>OpenRestoException.Code</c> and echoed on <c>MessageResponse.Code</c> alongside the
/// existing English <c>message</c> — the code is what a client branches on, the message is what
/// it shows. One constant per distinct rule, not per throw site: two throw sites rejecting for
/// the same reason share a code, even across different controllers or exception types.
/// </summary>
/// <remarks>
/// Does not cover the ~35 <c>[StringLength]</c>/<c>[Required]</c>-style <c>ErrorMessage</c>
/// values on request DTOs (e.g. <c>BrandRequest</c>). Model-state validation fails before a
/// controller action runs, so those never reach <c>GlobalExceptionHandler</c> — giving them a
/// code is a follow-up epic, not part of #375.
/// </remarks>
public static class ErrorCodes
{
    // ── Bookings ─────────────────────────────────────────────────────────────
    public const string BookingPastDate = "booking.past_date";
    public const string BookingPaused = "booking.paused";
    public const string BookingPausedIndefinitely = "booking.paused_indefinitely";
    public const string BookingWalkInOnly = "booking.walk_in_only";
    public const string BookingWalkInOnlyToday = "booking.walk_in_only_today";
    public const string BookingTableConflict = "booking.table_conflict";
    public const string BookingTableHeld = "booking.table_held";
    public const string BookingNoTablesAvailable = "booking.no_tables_available";
    public const string BookingAllTablesHeld = "booking.all_tables_held";
    public const string BookingAmbiguousTableSelection = "booking.ambiguous_table_selection";
    public const string BookingPartySizeOutOfRange = "booking.party_size_out_of_range";
    public const string BookingAlreadyPast = "booking.already_past";
    public const string BookingAlreadyActive = "booking.already_active";
    public const string BookingMoveConflict = "booking.move_conflict";
    public const string BookingTableNotInSection = "booking.table_not_in_section";
    public const string BookingInvalidTableForRestaurant = "booking.invalid_table_for_restaurant";
    public const string BookingSectionMismatch = "booking.section_mismatch";
    public const string BookingTableIdRequiredForSectionChange = "booking.table_id_required_for_section_change";
    public const string BookingEmailFieldsRequired = "booking.email_fields_required";
    public const string BookingNoCustomerEmail = "booking.no_customer_email";
    public const string BookingEmailSendFailed = "booking.email_send_failed";
    public const string BookingLookupEmailRequired = "booking.lookup_email_required";
    public const string BookingLookupNotFound = "booking.lookup_not_found";
    public const string BookingCancelEmailRequired = "booking.cancel_email_required";

    public const string TableSeatsExceeded = "table.seats_exceeded";
    public const string TableOversizeCap = "table.oversize_cap";
    public const string TableSeatsOutOfRange = "table.seats_out_of_range";

    public const string TableGroupNotFound = "table_group.not_found";
    public const string TableGroupBookingConflict = "table_group.booking_conflict";
    public const string TableGroupHoldConflict = "table_group.hold_conflict";
    public const string TableGroupDisbanded = "table_group.disbanded";
    public const string TableGroupSeatsExceeded = "table_group.seats_exceeded";
    public const string TableGroupOversizeCap = "table_group.oversize_cap";
    public const string TableGroupNoMembers = "table_group.no_members";
    public const string TableGroupMinMembers = "table_group.min_members";
    public const string TableGroupDuplicateMember = "table_group.duplicate_member";
    public const string TableGroupInvalidMembers = "table_group.invalid_members";
    public const string TableGroupMemberAlreadyGrouped = "table_group.member_already_grouped";
    public const string TableGroupCombinedSeatsExceedsSum = "table_group.combined_seats_exceeds_sum";
    public const string TableGroupCombinedSeatsNotWorthCombining = "table_group.combined_seats_not_worth_combining";

    public const string HoldAmbiguousGroupAndTable = "hold.ambiguous_group_and_table";
    public const string HoldGroupSeatsRequired = "hold.group_seats_required";
    public const string HoldAutoAssignSeatsRequired = "hold.auto_assign_seats_required";
    public const string HoldUnavailable = "hold.unavailable";

    // ── Locations ────────────────────────────────────────────────────────────
    public const string RestaurantNotFound = "restaurant.not_found";
    public const string RestaurantNoSections = "restaurant.no_sections";
    public const string RestaurantNameRequired = "restaurant.name_required";
    public const string RestaurantArchiveBeforeDelete = "restaurant.archive_before_delete";
    public const string RestaurantClosedAtTime = "restaurant.closed_at_time";
    public const string RestaurantDurationInvalid = "restaurant.duration_invalid";
    public const string RestaurantSlotIntervalInvalid = "restaurant.slot_interval_invalid";
    public const string RestaurantOversizeCapInvalid = "restaurant.oversize_cap_invalid";
    public const string RestaurantMenuUrlInvalid = "restaurant.menu_url_invalid";
    public const string RestaurantBookingRefFormatInvalid = "restaurant.booking_ref_format_invalid";
    public const string RestaurantWalkInDaysInvalid = "restaurant.walk_in_days_invalid";
    public const string RestaurantOpenHoursDayInvalid = "restaurant.open_hours_day_invalid";
    public const string RestaurantOpenHoursDuplicateDay = "restaurant.open_hours_duplicate_day";
    public const string RestaurantOpenHoursTimeInvalid = "restaurant.open_hours_time_invalid";
    public const string RestaurantSectionIdsMismatch = "restaurant.section_ids_mismatch";

    // ── Accounts ─────────────────────────────────────────────────────────────
    public const string UserEmailAlreadyExists = "user.email_already_exists";
    public const string UserCannotChangeOwnRole = "user.cannot_change_own_role";
    public const string UserCannotDeactivateSelf = "user.cannot_deactivate_self";
    public const string UserLastActiveOwnerDemote = "user.last_active_owner_demote";
    public const string UserLastActiveOwnerDeactivate = "user.last_active_owner_deactivate";
    public const string UserNotFound = "user.not_found";
    public const string UserEmailInvalid = "user.email_invalid";
    public const string UserEmailTooLong = "user.email_too_long";
    public const string UserDisplayNameTooLong = "user.display_name_too_long";
    public const string UserPasswordTooShort = "user.password_too_short";
    public const string UserRoleInvalid = "user.role_invalid";

    // ── API keys ─────────────────────────────────────────────────────────────
    public const string ApiKeyNameRequired = "api_key.name_required";
    public const string ApiKeyNameTooLong = "api_key.name_too_long";
    public const string ApiKeyScopesRequired = "api_key.scopes_required";
    public const string ApiKeyScopeInvalid = "api_key.scope_invalid";
    public const string ApiKeyExpiresAtInPast = "api_key.expires_at_in_past";
    public const string ApiKeyExpiresAtWithNeverExpires = "api_key.expires_at_with_never_expires";
    public const string ApiKeyNotFound = "api_key.not_found";
    public const string ApiKeyScopeMissing = "api_key.scope_missing";
    public const string ApiKeyNotAllowed = "api_key.not_allowed";
    public const string ApiKeyNotASession = "api_key.not_a_session";

    public const string AuthEmailUnchanged = "auth.email_unchanged";
    public const string AuthEmailAlreadyInUse = "auth.email_already_in_use";
    public const string AuthPvqFieldsRequired = "auth.pvq_fields_required";
    public const string AuthPvqNotConfigured = "auth.pvq_not_configured";
    public const string AuthInvalidResetToken = "auth.invalid_reset_token";
    public const string AuthNoAccountForSession = "auth.no_account_for_session";

    // ── Instance settings ────────────────────────────────────────────────────
    public const string BrandAppNameTooLong = "brand.app_name_too_long";
    public const string BrandPrimaryColorInvalid = "brand.primary_color_invalid";
    public const string BrandAccentColorInvalid = "brand.accent_color_invalid";
    public const string BrandFaviconInvalid = "brand.favicon_invalid";
    public const string BrandCopyrightTooLong = "brand.copyright_too_long";
    public const string BrandSubtitleTooLong = "brand.subtitle_too_long";
    public const string BrandHighlightsHeadingTooLong = "brand.highlights_heading_too_long";
    public const string BrandHighlightsSubheadingTooLong = "brand.highlights_subheading_too_long";
    public const string BrandHeaderImageFitInvalid = "brand.header_image_fit_invalid";

    public const string HighlightTitleRequired = "highlight.title_required";
    public const string HighlightTitleTooLong = "highlight.title_too_long";
    public const string HighlightBodyTooLong = "highlight.body_too_long";
    public const string HighlightLinkInvalid = "highlight.link_invalid";

    public const string SocialLinkLabelRequired = "social_link.label_required";
    public const string SocialLinkLabelTooLong = "social_link.label_too_long";
    public const string SocialLinkUrlRequired = "social_link.url_required";
    public const string SocialLinkUrlInvalid = "social_link.url_invalid";

    /// <summary>Shared by highlights and social links: both validate an icon key against the same allow-list.</summary>
    public const string IconInvalid = "icon.invalid";

    public const string ContactPhoneTooLong = "contact.phone_too_long";
    public const string ContactEmailTooLong = "contact.email_too_long";
    public const string ContactEmailInvalid = "contact.email_invalid";

    // ── Media ────────────────────────────────────────────────────────────────
    public const string MediaUnsupportedImageType = "media.unsupported_image_type";
    public const string MediaHeroTooLarge = "media.hero_too_large";
    public const string MediaLocationImageTooLarge = "media.location_image_too_large";
    public const string MediaUnsupportedMenuType = "media.unsupported_menu_type";
    public const string MediaMenuTooLarge = "media.menu_too_large";

    // ── Infrastructure ───────────────────────────────────────────────────────
    public const string EmailNotConfigured = "email.not_configured";
    public const string EmailConnectionFailed = "email.connection_failed";
    public const string AdminPasswordNotConfigured = "admin.password_not_configured";
}
