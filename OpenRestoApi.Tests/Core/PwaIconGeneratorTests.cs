using ImageMagick;
using OpenRestoApi.Core.Application;

namespace OpenRestoApi.Tests.Core;

public class PwaIconGeneratorTests
{
    private const string BrandColor = "#123456";
    private const byte BrandRed = 0x12;
    private const byte BrandGreen = 0x34;
    private const byte BrandBlue = 0x56;

    private static string Glyph(string iconId) => LucideIconPaths.Get(iconId)!;

    private static MagickImage Read(byte[] png) => new(png);

    /// <summary>Row-major RGBA bytes, so a pixel's alpha is one index rather than one allocation.</summary>
    private static byte[] Rgba(IMagickImage<byte> image) => image.GetPixels().ToByteArray(PixelMapping.RGBA)!;

    private static byte AlphaAt(byte[] rgba, int width, int x, int y) => rgba[(((y * width) + x) * 4) + 3];

    [Theory]
    [InlineData(192)]
    [InlineData(512)]
    public void Generate_ReturnsNonEmptyByteArray(int size)
    {
        byte[] result = PwaIconGenerator.Generate(size, "#0a7ea4", Glyph("utensils"));
        Assert.NotEmpty(result);
    }

    [Theory]
    [InlineData(192)]
    [InlineData(512)]
    public void Generate_ReturnsPngMagicBytes(int size)
    {
        byte[] result = PwaIconGenerator.Generate(size, "#ff5500", Glyph("star"));

        // PNG signature: 0x89 P N G 0x0D 0x0A 0x1A 0x0A
        Assert.True(result.Length >= 8);
        Assert.Equal(0x89, result[0]);
        Assert.Equal(0x50, result[1]); // P
        Assert.Equal(0x4E, result[2]); // N
        Assert.Equal(0x47, result[3]); // G
    }

    [Fact]
    public void Generate_DifferentSizeProducesDifferentOutput()
    {
        byte[] small = PwaIconGenerator.Generate(192, BrandColor, Glyph("heart"));
        byte[] large = PwaIconGenerator.Generate(512, BrandColor, Glyph("heart"));

        Assert.NotEqual(small.Length, large.Length);
    }

    [Fact]
    public void Generate_RoundsPwaCornersOutOfTheAlphaChannel()
    {
        using MagickImage image = Read(PwaIconGenerator.Generate(512, BrandColor, Glyph("utensils")));

        Assert.True(image.HasAlpha);
        Assert.Equal(0, AlphaAt(Rgba(image), (int)image.Width, 0, 0));
    }

    [Fact]
    public void GenerateAppStoreIcon_IsSquareAtTheAppStoreSize()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAppStoreIcon(BrandColor, Glyph("utensils")));

        Assert.Equal((uint)PwaIconGenerator.AppStoreIconSize, image.Width);
        Assert.Equal((uint)PwaIconGenerator.AppStoreIconSize, image.Height);
    }

    [Fact]
    public void GenerateAppStoreIcon_HasNoAlphaChannel()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAppStoreIcon(BrandColor, Glyph("wine")));

        Assert.False(image.HasAlpha);
    }

    [Fact]
    public void GenerateAppStoreIcon_FillsCornerWithBrandColor()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAppStoreIcon(BrandColor, Glyph("utensils")));

        IMagickColor<byte> corner = image.GetPixels().GetPixel(0, 0).ToColor()!;
        Assert.Equal(BrandRed, corner.R);
        Assert.Equal(BrandGreen, corner.G);
        Assert.Equal(BrandBlue, corner.B);
    }

    [Fact]
    public void GenerateAppStoreIcon_DrawsTheGlyphInWhite()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAppStoreIcon(BrandColor, Glyph("utensils")));

        byte[] rgba = Rgba(image);
        bool anyWhite = false;
        for (int i = 0; i < rgba.Length && !anyWhite; i += 4)
        {
            anyWhite = rgba[i] > 0xF0 && rgba[i + 1] > 0xF0 && rgba[i + 2] > 0xF0;
        }

        Assert.True(anyWhite, "expected white glyph strokes over the brand-coloured fill");
    }

    [Fact]
    public void GenerateAdaptiveForeground_IsSquareAtTheAdaptiveLayerSize()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAdaptiveForeground(BrandColor, Glyph("utensils")));

        Assert.Equal((uint)PwaIconGenerator.AdaptiveForegroundSize, image.Width);
        Assert.Equal((uint)PwaIconGenerator.AdaptiveForegroundSize, image.Height);
    }

    [Fact]
    public void GenerateAdaptiveForeground_KeepsBackgroundTransparent()
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAdaptiveForeground(BrandColor, Glyph("utensils")));

        Assert.True(image.HasAlpha);
        Assert.Equal(0, AlphaAt(Rgba(image), (int)image.Width, 0, 0));
    }

    [Theory]
    [InlineData("utensils")]
    [InlineData("star")]
    [InlineData("sandwich")]
    public void GenerateAdaptiveForeground_DrawsGlyphInsideSafeZone(string iconId)
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAdaptiveForeground(BrandColor, Glyph(iconId)));
        byte[] rgba = Rgba(image);
        int size = (int)image.Width;
        (int start, int end) = SafeZone(size);

        bool anyDrawn = false;
        for (int y = start; y < end && !anyDrawn; y++)
        {
            for (int x = start; x < end && !anyDrawn; x++)
            {
                anyDrawn = AlphaAt(rgba, size, x, y) > 0;
            }
        }

        Assert.True(anyDrawn, "expected the glyph to be drawn inside the safe zone");
    }

    [Theory]
    [InlineData("utensils")]
    [InlineData("star")]
    [InlineData("sandwich")]
    public void GenerateAdaptiveForeground_DrawsNothingOutsideSafeZone(string iconId)
    {
        using MagickImage image = Read(PwaIconGenerator.GenerateAdaptiveForeground(BrandColor, Glyph(iconId)));
        byte[] rgba = Rgba(image);
        int size = (int)image.Width;
        (int start, int end) = SafeZone(size);

        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                bool inside = x >= start && x < end && y >= start && y < end;
                if (!inside && AlphaAt(rgba, size, x, y) != 0)
                {
                    Assert.Fail($"{iconId} paints ({x},{y}), outside the {start}..{end} safe zone");
                }
            }
        }
    }

    private static (int Start, int End) SafeZone(int size)
    {
        int zone = (int)(size * PwaIconGenerator.AdaptiveSafeZoneFraction);
        int start = (size - zone) / 2;
        return (start, start + zone);
    }
}
