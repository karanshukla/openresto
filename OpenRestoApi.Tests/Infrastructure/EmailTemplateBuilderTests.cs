using OpenRestoApi.Infrastructure.Email;

namespace OpenRestoApi.Tests.Infrastructure;

public class EmailTemplateBuilderTests
{
    [Fact]
    public void Wrap_ContainsSharedShell()
    {
        string html = EmailTemplateBuilder.Wrap("#0a7ea4", "MyApp", "https://example.com", "<tr><td>header</td></tr>", "<tr><td>body</td></tr>");

        Assert.Contains("<!DOCTYPE html>", html);
        Assert.Contains("background-color:#f9fafb", html);
        Assert.Contains("max-width:520px", html);
        Assert.Contains("header", html);
        Assert.Contains("body", html);
    }

    [Fact]
    public void Wrap_Footer_ContainsWebsiteUrlAndCopyright()
    {
        string html = EmailTemplateBuilder.Wrap("#0a7ea4", "MyApp", "https://example.com/", "", "");

        Assert.Contains("example.com", html);
        Assert.Contains("MyApp", html);
        Assert.Contains("&copy;", html);
        Assert.Contains(DateTime.UtcNow.Year.ToString(), html);
    }

    [Fact]
    public void Wrap_StripsTrailingSlashFromUrl()
    {
        string html = EmailTemplateBuilder.Wrap("#0a7ea4", "MyApp", "https://example.com/", "", "");

        Assert.Contains("href=\"https://example.com\"", html);
    }

    [Fact]
    public void Wrap_HtmlEncodesAppName()
    {
        string html = EmailTemplateBuilder.Wrap("#0a7ea4", "My <App>", "https://example.com", "", "");

        Assert.Contains("My &lt;App&gt;", html);
        Assert.DoesNotContain("My <App>", html);
    }

    [Fact]
    public void BannerHeader_ContainsImageAndTitle()
    {
        string html = EmailTemplateBuilder.BannerHeader("https://cdn.example.com/photo.jpg", "My Restaurant", "My Restaurant", "Booking Confirmed");

        Assert.Contains("https://cdn.example.com/photo.jpg", html);
        Assert.Contains("width:100%", html);
        Assert.Contains("height:200px", html);
        Assert.Contains("object-fit:cover", html);
        Assert.Contains("My Restaurant", html);
        Assert.Contains("Booking Confirmed", html);
    }

    [Fact]
    public void BannerHeader_EmptySubtitle_OmitsSubtitleElement()
    {
        string html = EmailTemplateBuilder.BannerHeader("https://cdn.example.com/photo.jpg", "Alt", "Title", "");

        Assert.DoesNotContain("<p style='margin:8px", html);
    }

    [Fact]
    public void BannerHeader_HtmlEncodesAltAndTitle()
    {
        string html = EmailTemplateBuilder.BannerHeader("https://x.com/img.jpg", "Alt <b>text</b>", "Title <b>text</b>", "Sub");

        Assert.Contains("Alt &lt;b&gt;text&lt;/b&gt;", html);
        Assert.Contains("Title &lt;b&gt;text&lt;/b&gt;", html);
    }

    [Fact]
    public void IconHeader_ContainsIconAndTitle()
    {
        string html = EmailTemplateBuilder.IconHeader("https://example.com/api/brand/pwa-icon.svg", "MyApp", "Restaurant Name", "Booking Confirmed");

        Assert.Contains("https://example.com/api/brand/pwa-icon.svg", html);
        Assert.Contains("width:72px", html);
        Assert.Contains("height:72px", html);
        Assert.Contains("border-radius:12px", html);
        Assert.Contains("Restaurant Name", html);
        Assert.Contains("Booking Confirmed", html);
    }

    [Fact]
    public void IconHeader_EmptySubtitle_OmitsSubtitleElement()
    {
        string html = EmailTemplateBuilder.IconHeader("https://example.com/icon.svg", "App", "Title", "");

        Assert.DoesNotContain("<p style='margin:8px", html);
    }

    [Fact]
    public void IconHeader_HtmlEncodesAltAndTitle()
    {
        string html = EmailTemplateBuilder.IconHeader("https://x.com/icon.svg", "Alt <x>", "Title <x>", "Sub");

        Assert.Contains("Alt &lt;x&gt;", html);
        Assert.Contains("Title &lt;x&gt;", html);
    }

    [Fact]
    public void TextHeader_ContainsAppNameInPrimaryColor()
    {
        string html = EmailTemplateBuilder.TextHeader("My Restaurant", "#ff5500");

        Assert.Contains("My Restaurant", html);
        Assert.Contains("#ff5500", html);
        Assert.Contains("border-bottom:3px solid #ff5500", html);
    }

    [Fact]
    public void TextHeader_HtmlEncodesAppName()
    {
        string html = EmailTemplateBuilder.TextHeader("My <App>", "#0a7ea4");

        Assert.Contains("My &lt;App&gt;", html);
        Assert.DoesNotContain("My <App>", html);
    }
}
