using System.Globalization;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The dotted action keys an audit entry can carry, and the target types they point at. Keys
/// are <c>noun.verb</c> and are matched by prefix on the read side, so everything a reviewer
/// would filter as one group shares a first segment.
/// </summary>
public static class AuditActions
{
    // ── Bookings ─────────────────────────────────────────────────────────────
    public const string BookingCreate = "booking.create";
    public const string BookingUpdate = "booking.update";
    public const string BookingCancel = "booking.cancel";
    public const string BookingRestore = "booking.restore";
    public const string BookingExtend = "booking.extend";
    public const string BookingPurge = "booking.purge";
    public const string BookingEmail = "booking.email";

    // ── Locations ────────────────────────────────────────────────────────────
    public const string RestaurantCreate = "restaurant.create";
    public const string RestaurantUpdate = "restaurant.update";
    public const string RestaurantArchive = "restaurant.archive";
    public const string RestaurantRestore = "restaurant.restore";
    public const string RestaurantDelete = "restaurant.delete";
    public const string RestaurantPause = "restaurant.pause";
    public const string RestaurantUnpause = "restaurant.unpause";
    public const string RestaurantExtendBookings = "restaurant.extend_bookings";
    public const string RestaurantReorderSections = "restaurant.reorder_sections";

    public const string SectionCreate = "section.create";
    public const string SectionUpdate = "section.update";
    public const string SectionDelete = "section.delete";

    public const string TableCreate = "table.create";
    public const string TableUpdate = "table.update";
    public const string TableDelete = "table.delete";

    public const string TableGroupCreate = "table_group.create";
    public const string TableGroupUpdate = "table_group.update";
    public const string TableGroupDelete = "table_group.delete";

    // ── Accounts ─────────────────────────────────────────────────────────────
    public const string UserCreate = "user.create";
    public const string UserRoleChange = "user.role_change";
    public const string UserActivate = "user.activate";
    public const string UserDeactivate = "user.deactivate";
    public const string UserPasswordReset = "user.password_reset";

    public const string AuthLogin = "auth.login";
    public const string AuthLoginFailed = "auth.login_failed";
    public const string AuthLogout = "auth.logout";
    public const string AuthPasswordChange = "auth.password_change";
    public const string AuthEmailChange = "auth.email_change";
    public const string AuthPvqSetup = "auth.pvq_setup";
    public const string AuthPasswordReset = "auth.password_reset";

    // ── Instance settings ────────────────────────────────────────────────────
    public const string BrandUpdate = "brand.update";
    public const string EmailSettingsUpdate = "email_settings.update";
    public const string EmailSettingsTest = "email_settings.test";

    public const string MediaUpload = "media.upload";
    public const string MediaDelete = "media.delete";

    public const string HighlightCreate = "highlight.create";
    public const string HighlightUpdate = "highlight.update";
    public const string HighlightDelete = "highlight.delete";

    public const string SocialLinkCreate = "social_link.create";
    public const string SocialLinkUpdate = "social_link.update";
    public const string SocialLinkDelete = "social_link.delete";

    public const string NotificationDelete = "notification.delete";
    public const string PushSubscribe = "push.subscribe";
    public const string PushUnsubscribe = "push.unsubscribe";

    /// <summary>
    /// The floor: a mutating admin request no service described still lands a row, keyed by its
    /// method. New endpoints are therefore audited the day they ship, just without a readable
    /// label until someone enriches them.
    /// </summary>
    public static string ForUndescribedRequest(string httpMethod)
        => $"http.{httpMethod.ToLowerInvariant()}";
}

/// <summary>The <c>TargetType</c> values an entry can carry.</summary>
public static class AuditTargets
{
    /// <summary>
    /// An entity's primary key as a <c>TargetId</c>. The column is a string so booking refs and
    /// numeric ids both fit, and every service coerces through here so the stored form is
    /// invariant rather than the request thread's culture.
    /// </summary>
    public static string IdOf(int id) => id.ToString(CultureInfo.InvariantCulture);

    public const string Booking = "Booking";
    public const string Restaurant = "Restaurant";
    public const string Section = "Section";
    public const string Table = "Table";
    public const string TableGroup = "TableGroup";
    public const string User = "User";
    public const string Brand = "Brand";
    public const string EmailSettings = "EmailSettings";
    public const string Media = "Media";
    public const string Highlight = "Highlight";
    public const string SocialLink = "SocialLink";
    public const string Notification = "Notification";
}
