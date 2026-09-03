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

    /// <summary>
    /// The address a store's verifier fetches a well-known document from: the site's origin plus
    /// the fixed path, and nothing the configured address carried after its host. Apple and
    /// Google both read from the domain root, so a public address under a sub-path is rooted;
    /// and because the path is composed rather than appended, a query string on the address
    /// cannot swallow it and turn the probe into a fetch of an arbitrary URL.
    /// </summary>
    /// <seealso>NativeAppStatusServiceTests.WellKnownChecks_FetchFromTheSiteRootAndDropTheQuery</seealso>
    /// <seealso>NativeAppStatusServiceTests.WellKnownChecks_SkipANonHttpAddress</seealso>
    public static bool TryBuildWellKnownUrl(string websiteUrl, string path, out Uri url)
    {
        url = null!;
        if (!Uri.TryCreate(websiteUrl, UriKind.Absolute, out Uri? site)
            || (site.Scheme != Uri.UriSchemeHttp && site.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(site.UserInfo))
        {
            return false;
        }

        url = new UriBuilder(site.Scheme, site.Host, site.Port, path).Uri;
        return true;
    }
}
