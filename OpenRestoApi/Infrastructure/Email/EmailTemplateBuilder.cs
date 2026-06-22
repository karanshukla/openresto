using System.Net;

namespace OpenRestoApi.Infrastructure.Email;

public static class EmailTemplateBuilder
{
    /// <summary>
    /// Wraps header + content HTML in the shared branded email shell (outer table, card, footer).
    /// </summary>
    public static string Wrap(
        string primaryColor,
        string appName,
        string websiteUrl,
        string headerHtml,
        string contentHtml)
    {
        string cleanUrl = websiteUrl.TrimEnd('/');
        string displayUrl = cleanUrl.Replace("https://", "").Replace("http://", "");
        int year = DateTime.UtcNow.Year;

        return $"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
                <tr><td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
                    {headerHtml}
                    {contentHtml}
                    <tr><td style="padding:0 40px 32px;border-top:1px solid #f0f0f0;text-align:center;">
                      <p style="margin:24px 0 4px;font-size:13px;color:#6b7280;">
                        <a href="{cleanUrl}" style="color:{primaryColor};text-decoration:none;">{displayUrl}</a>
                      </p>
                      <p style="margin:0;font-size:12px;color:#9ca3af;">
                        &copy; {year} {WebUtility.HtmlEncode(appName)}
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }

    /// <summary>
    /// Full-width restaurant banner photo header (landscape image, cropped to fixed height).
    /// Use when the restaurant has a photo uploaded.
    /// </summary>
    public static string BannerHeader(string imageUrl, string altText, string title, string subtitle)
    {
        string subtitleHtml = string.IsNullOrEmpty(subtitle) ? "" :
            $"<p style='margin:8px 0 0;font-size:16px;color:#6b7280;'>{WebUtility.HtmlEncode(subtitle)}</p>";
        return $"""
            <tr><td style="padding:0;text-align:center;background-color:#ffffff;">
              <img src="{imageUrl}" alt="{WebUtility.HtmlEncode(altText)}"
                   width="520"
                   style="width:100%;max-width:520px;height:200px;object-fit:cover;display:block;">
              <div style="padding:24px 40px 20px;">
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{WebUtility.HtmlEncode(title)}</h1>
                {subtitleHtml}
              </div>
            </td></tr>
            """;
    }

    /// <summary>
    /// Small square brand icon (72 × 72 px) centered above the title.
    /// Use when there's no restaurant photo but a brand favicon icon is set.
    /// </summary>
    public static string IconHeader(string iconUrl, string altText, string title, string subtitle)
    {
        string subtitleHtml = string.IsNullOrEmpty(subtitle) ? "" :
            $"<p style='margin:8px 0 0;font-size:16px;color:#6b7280;'>{WebUtility.HtmlEncode(subtitle)}</p>";
        return $"""
            <tr><td style="padding:40px 40px 24px;text-align:center;background-color:#ffffff;">
              <img src="{iconUrl}" alt="{WebUtility.HtmlEncode(altText)}"
                   width="72" height="72"
                   style="width:72px;height:72px;display:block;margin:0 auto 16px;border-radius:12px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827;">{WebUtility.HtmlEncode(title)}</h1>
              {subtitleHtml}
            </td></tr>
            """;
    }

    /// <summary>
    /// Text-only header with the app name styled in the primary brand colour.
    /// Fallback when no image or icon is available.
    /// </summary>
    public static string TextHeader(string appName, string primaryColor)
    {
        return $"""
            <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:3px solid {primaryColor};">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:{primaryColor};">{WebUtility.HtmlEncode(appName)}</h1>
            </td></tr>
            """;
    }
}
