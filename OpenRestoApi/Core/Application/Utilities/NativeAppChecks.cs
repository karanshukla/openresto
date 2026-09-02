namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The vocabulary of the native-app readiness checklist: the check ids and statuses the admin
/// screen renders, and the two well-known paths a store's deep-link verification fetches. The
/// ids are part of the API contract — the frontend keys its copy off them — so they are
/// constants here rather than literals at the call sites that build the list.
/// </summary>
public static class NativeAppChecks
{
    public const string Https = "https";
    public const string BrandIcon = "brandIcon";
    public const string PrivacyPolicy = "privacyPolicy";
    public const string AppleAppSiteAssociation = "appleAppSiteAssociation";
    public const string AndroidAssetLinks = "androidAssetLinks";
    public const string AppleWallet = "appleWallet";
    public const string GoogleWallet = "googleWallet";

    public const string Pass = "pass";
    public const string Fail = "fail";

    /// <summary>A check that could not be run at all, rather than one that ran and failed.</summary>
    public const string Skip = "skip";

    public const string AppleAssociationPath = "/.well-known/apple-app-site-association";
    public const string AndroidAssetLinksPath = "/.well-known/assetlinks.json";

    /// <summary>The iOS app icon a store listing needs; the check reports whether it will render.</summary>
    public const string AppIconPath = "/api/brand/app-icon-ios.png";

    /// <summary>What both well-known documents must be served as.</summary>
    public const string RequiredContentType = "application/json";
}
