using System.Globalization;
using System.Text;
using ImageMagick;

namespace OpenRestoApi.Core.Application;

public static class PwaIconGenerator
{
    /// <summary>Lucide paths are authored on a 24-unit grid; every variant maps that grid onto its own canvas.</summary>
    private const float GlyphGridUnits = 24f;

    private const float PwaGlyphFraction = 0.6f;
    private const float PwaCornerRadiusFraction = 0.22f;
    private const float SquareCorners = 0f;

    /// <summary>The single size App Store Connect accepts for an app icon.</summary>
    public const int AppStoreIconSize = 1024;

    /// <summary>An Android adaptive icon layer is 108dp; 432px is that at xxxhdpi.</summary>
    public const int AdaptiveForegroundSize = 432;

    /// <summary>
    /// A launcher may crop an adaptive icon layer to any shape inside the centre 66dp of its
    /// 108dp canvas, so the glyph has to fit that fraction or lose its edges on some devices.
    /// </summary>
    public const float AdaptiveSafeZoneFraction = 66f / 108f;

    /// <summary>
    /// The white Lucide glyph on a brand-coloured rounded square, with the rounding cut out of
    /// the alpha channel. This is the web/PWA icon shape.
    /// </summary>
    public static byte[] Generate(int size, string hexColor, string svgInner) =>
        Render(new IconVariant(size, PwaGlyphFraction, hexColor, PwaCornerRadiusFraction), svgInner);

    /// <summary>
    /// The 1024x1024 iOS icon: fully opaque, square-cornered, alpha channel stripped. App Store
    /// Connect rejects a binary whose icon has any transparency and applies the corner mask itself,
    /// so the PWA shape is exactly what cannot ship here.
    /// </summary>
    /// <seealso>PwaIconGeneratorTests.GenerateAppStoreIcon_HasNoAlphaChannel</seealso>
    /// <seealso>PwaIconGeneratorTests.GenerateAppStoreIcon_FillsCornerWithBrandColor</seealso>
    public static byte[] GenerateAppStoreIcon(string hexColor, string svgInner) =>
        Render(
            new IconVariant(AppStoreIconSize, PwaGlyphFraction, hexColor, SquareCorners, FlattenToOpaque: true),
            svgInner);

    /// <summary>
    /// The foreground layer of the Android adaptive icon: the white glyph alone on transparency,
    /// scaled into the safe zone. The background layer is a solid brand colour declared in the
    /// Expo config, which is why <paramref name="hexColor"/> paints nothing here — it keeps the
    /// three variants callable through one signature.
    /// </summary>
    /// <seealso>PwaIconGeneratorTests.GenerateAdaptiveForeground_KeepsBackgroundTransparent</seealso>
    /// <seealso>PwaIconGeneratorTests.GenerateAdaptiveForeground_DrawsGlyphInsideSafeZone</seealso>
    /// <seealso>PwaIconGeneratorTests.GenerateAdaptiveForeground_DrawsNothingOutsideSafeZone</seealso>
#pragma warning disable IDE0060 // hexColor is unused on purpose: see the summary above. It keeps
    // all three variants callable through the one (colour, glyph) signature the controller shares.
    public static byte[] GenerateAdaptiveForeground(string hexColor, string svgInner) =>
        Render(
            new IconVariant(AdaptiveForegroundSize, AdaptiveSafeZoneFraction, Background: null),
            svgInner);
#pragma warning restore IDE0060

    private sealed record IconVariant(
        int Size,
        float GlyphFraction,
        string? Background,
        float CornerRadiusFraction = SquareCorners,
        bool FlattenToOpaque = false);

    private static byte[] Render(IconVariant variant, string svgInner)
    {
        int size = variant.Size;
        float scale = size * variant.GlyphFraction / GlyphGridUnits;
        float inset = size * (1f - variant.GlyphFraction) / 2f;
        int cornerRadius = (int)(size * variant.CornerRadiusFraction);

        string background = variant.Background is null
            ? string.Empty
            : $"""<rect width="{size}" height="{size}" rx="{cornerRadius}" ry="{cornerRadius}" fill="{variant.Background}"/>""";

        string svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}">
              {background}
              <g transform="translate({Svg(inset)},{Svg(inset)}) scale({Svg(scale)})"
                 stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                {svgInner}
              </g>
            </svg>
            """;

        var settings = new MagickReadSettings
        {
            Format = MagickFormat.Svg,
            Width = (uint)size,
            Height = (uint)size,
            BackgroundColor = MagickColors.Transparent,
        };

        using var image = new MagickImage(Encoding.UTF8.GetBytes(svg), settings);
        if (variant is { FlattenToOpaque: true, Background: { } opaqueBackground })
        {
            image.BackgroundColor = new MagickColor(opaqueBackground);
            image.Alpha(AlphaOption.Remove);
            image.Alpha(AlphaOption.Off);
        }

        image.Format = MagickFormat.Png;
        return image.ToByteArray();
    }

    /// <summary>SVG numbers are always dot-decimal, whatever the server's culture.</summary>
    private static string Svg(float value) => value.ToString("0.####", CultureInfo.InvariantCulture);
}
