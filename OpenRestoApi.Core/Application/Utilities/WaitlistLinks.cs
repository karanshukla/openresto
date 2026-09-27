using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Utilities;

public static class WaitlistLinks
{
    public static string Status(string websiteUrl, WaitlistEntry entry) =>
        $"{websiteUrl.TrimEnd('/')}/waitlist/{Uri.EscapeDataString(entry.Ref)}";
}
