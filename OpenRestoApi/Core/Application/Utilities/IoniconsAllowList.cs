namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// Allow-list of <c>@expo/vector-icons/Ionicons</c> icon keys accepted by the Social Link and
/// Highlight services. Source of truth is the frontend <c>ICON_OPTIONS</c> arrays (UI only lets
/// the admin pick from these), mirrored server-side so a hand-crafted request can't persist an
/// icon key the frontend can't render. Distinct from <c>LucideIconPaths</c>, which is the
/// brand/favicon set — the two icon families do not overlap.
/// </summary>
/// <remarks>
/// <para>
/// Keep this in sync with:
/// </para>
/// <list type="bullet">
/// <item><c>openresto-frontend/components/admin/settings/SocialLinkEditForm.tsx</c> (<c>ICON_OPTIONS</c>)</item>
/// <item><c>openresto-frontend/components/admin/settings/HighlightsCard.tsx</c> (<c>ICON_OPTIONS</c>)</item>
/// </list>
/// <para>
/// <see cref="LegacyIcons"/> retains non-<c>-outline</c> variants (<c>star</c>, <c>flame</c>) that
/// appear in pre-existing integration tests and may exist in seeded client data from before the
/// frontend normalised to <c>-outline</c> names; rejecting them would break working deployments.
/// </para>
/// </remarks>
public static class IoniconsAllowList
{
    /// <summary>
    /// Icon keys selectable for social links. Mirrors
    /// <c>SocialLinkEditForm.tsx</c> <c>ICON_OPTIONS</c>.
    /// </summary>
    public static readonly HashSet<string> SocialLinkIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        "link-outline",
        "globe-outline",
        "mail-outline",
        "call-outline",
        "chatbubble-outline",
        "location-outline",
        "star-outline",
        "heart-outline",
        "megaphone-outline",
        "newspaper-outline",
        "storefront-outline",
        "cart-outline",
        "calendar-outline",
        "camera-outline",
        "logo-instagram",
        "logo-facebook",
        "logo-x",
        "logo-tiktok",
        "logo-youtube",
        "logo-linkedin",
        "logo-pinterest",
        "logo-whatsapp",
        "logo-snapchat",
        "logo-threads",
        "logo-reddit",
        "logo-discord",
    };

    /// <summary>
    /// Icon keys selectable for highlights. Mirrors <c>HighlightsCard.tsx</c> <c>ICON_OPTIONS</c>.
    /// </summary>
    public static readonly HashSet<string> HighlightIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        "flame-outline",
        "star-outline",
        "heart-outline",
        "sparkles-outline",
        "ribbon-outline",
        "trophy-outline",
        "thumbs-up-outline",
        "restaurant-outline",
        "wine-outline",
        "cafe-outline",
        "beer-outline",
        "pizza-outline",
        "ice-cream-outline",
        "leaf-outline",
        "nutrition-outline",
        "fish-outline",
        "egg-outline",
        "musical-notes-outline",
        "people-outline",
        "person-outline",
        "accessibility-outline",
        "car-outline",
        "wifi-outline",
        "card-outline",
        "gift-outline",
        "calendar-outline",
        "time-outline",
        "pricetag-outline",
        "camera-outline",
        "sunny-outline",
    };

    /// <summary>
    /// Legacy icon keys retained for backward compatibility with data seeded before the frontend
    /// normalised to <c>-outline</c> names and with pre-existing integration tests.
    /// </summary>
    public static readonly HashSet<string> LegacyIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        "star",
        "flame",
    };

    /// <summary>
    /// Every accepted icon key across social links, highlights, and legacy values. Services
    /// validate against this superset so an icon valid for either surface is accepted on either
    /// (the frontend picker is the stricter, per-surface gate).
    /// </summary>
    public static readonly HashSet<string> AllIcons = new(
        SocialLinkIcons.Concat(HighlightIcons).Concat(LegacyIcons),
        StringComparer.OrdinalIgnoreCase);
}
