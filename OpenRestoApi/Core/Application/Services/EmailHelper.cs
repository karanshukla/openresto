using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services
{
    //just a place to put some various email logic
    public static class EmailHelper
    {
        public static Task<string> WrapInBrandedEmail(string content, string appName, string primaryColor, string websiteUrl, string iconUrl = "")
        {
            bool isHtmlFragment = content.TrimStart().StartsWith('<');
            string innerHtml = isHtmlFragment
                ? content
                : System.Net.WebUtility.HtmlEncode(content).Replace("\n", "<br>").Replace("\r", "");

            string headerHtml = !string.IsNullOrEmpty(iconUrl)
                ? EmailTemplateBuilder.IconHeader(iconUrl, appName, appName, "")
                : EmailTemplateBuilder.TextHeader(appName, primaryColor);

            string contentHtml = $"""
            <tr><td style="padding:32px 40px;font-size:15px;line-height:1.7;color:#111827;">
              {innerHtml}
            </td></tr>
            """;

            return Task.FromResult(EmailTemplateBuilder.Wrap(primaryColor, appName, websiteUrl, headerHtml, contentHtml));
        }

        public static async Task<string> BuildEmailContentFromBrand(BrandService? brandService, string body)
        {
            string trimmed = body.TrimStart();
            bool isFullDocument = trimmed.StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase)
                                  || trimmed.StartsWith("<html", StringComparison.OrdinalIgnoreCase);

            if (brandService == null || isFullDocument)
            {
                return body;
            }

            BrandSettings brand = await brandService.GetAsync();
            string appName = brand.AppName ?? "Open Resto";
            string primaryColor = brand.PrimaryColor ?? "#0a7ea4";
            string websiteUrl = brandService.GetWebsiteUrl(brand).TrimEnd('/');
            string iconUrl = !string.IsNullOrEmpty(brand.FaviconIcon)
                ? $"{websiteUrl}/api/brand/pwa-icon.svg"
                : "";

            return await WrapInBrandedEmail(body, appName, primaryColor, websiteUrl, iconUrl);
        }
    }
}
