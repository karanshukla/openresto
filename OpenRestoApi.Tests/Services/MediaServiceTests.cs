using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;
using OpenRestoApi.Infrastructure.Persistence.Repositories;

namespace OpenRestoApi.Tests.Services;

public class MediaServiceTests : IDisposable
{
    private readonly string _tempRoot;

    public MediaServiceTests()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), "openresto-media-tests-" + Guid.NewGuid());
        Directory.CreateDirectory(_tempRoot);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
            Directory.Delete(_tempRoot, recursive: true);
        GC.SuppressFinalize(this);
    }

    private MediaService CreateService(AppDbContext db)
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(_tempRoot);
        return new MediaService(
            new BrandSettingsRepository(db),
            new RestaurantRepository(db),
            env.Object);
    }

    private string MediaDir => Path.Combine(_tempRoot, "wwwroot", "media");

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    [InlineData("image/gif", "bin")]
    public async Task UploadHeroAsync_WritesFileWithExpectedExtension(string contentType, string extension)
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadHeroAsync_WritesFileWithExpectedExtension) + extension);
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1, 2, 3]);

        string url = await svc.UploadHeroAsync(stream, contentType);

        Assert.StartsWith($"/media/hero.{extension}?v=", url);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"hero.{extension}")));
    }

    [Fact]
    public async Task UploadHeroAsync_CreatesBrandSettings_WhenNoneExist()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadHeroAsync_CreatesBrandSettings_WhenNoneExist));
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1]);

        string url = await svc.UploadHeroAsync(stream, "image/png");

        BrandSettings? brand = await db.Set<BrandSettings>().FirstOrDefaultAsync();
        Assert.NotNull(brand);
        Assert.Equal(url, brand.HeaderImageUrl);
    }

    [Fact]
    public async Task UploadHeroAsync_UpdatesExistingBrandSettings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadHeroAsync_UpdatesExistingBrandSettings));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "Existing" });
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1]);

        string url = await svc.UploadHeroAsync(stream, "image/png");

        Assert.Equal(1, await db.Set<BrandSettings>().CountAsync());
        BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
        Assert.Equal("Existing", brand.AppName);
        Assert.Equal(url, brand.HeaderImageUrl);
    }

    [Fact]
    public async Task UploadHeroAsync_RemovesPreviousHeroFiles()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadHeroAsync_RemovesPreviousHeroFiles));
        MediaService svc = CreateService(db);
        using (var first = new MemoryStream([1]))
            await svc.UploadHeroAsync(first, "image/jpeg");
        Assert.True(File.Exists(Path.Combine(MediaDir, "hero.jpg")));

        using var second = new MemoryStream([2]);
        await svc.UploadHeroAsync(second, "image/png");

        Assert.False(File.Exists(Path.Combine(MediaDir, "hero.jpg")));
        Assert.True(File.Exists(Path.Combine(MediaDir, "hero.png")));
    }

    [Fact]
    public async Task DeleteHeroAsync_NoOp_WhenNoBrandSettings()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_NoOp_WhenNoBrandSettings));
        MediaService svc = CreateService(db);

        await svc.DeleteHeroAsync();

        Assert.Null(await db.Set<BrandSettings>().FirstOrDefaultAsync());
    }

    [Fact]
    public async Task DeleteHeroAsync_NoOp_WhenHeaderImageUrlNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_NoOp_WhenHeaderImageUrlNull));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "X", HeaderImageUrl = null });
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        await svc.DeleteHeroAsync();

        BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
        Assert.Null(brand.HeaderImageUrl);
    }

    [Fact]
    public async Task DeleteHeroAsync_ClearsReferenceAndDeletesFile()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_ClearsReferenceAndDeletesFile));
        MediaService svc = CreateService(db);
        using (var stream = new MemoryStream([1]))
            await svc.UploadHeroAsync(stream, "image/png");
        Assert.True(File.Exists(Path.Combine(MediaDir, "hero.png")));

        await svc.DeleteHeroAsync();

        BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
        Assert.Null(brand.HeaderImageUrl);
        Assert.False(File.Exists(Path.Combine(MediaDir, "hero.png")));
    }

    [Fact]
    public async Task DeleteHeroAsync_DoesNotThrow_WhenFileAlreadyMissing()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_DoesNotThrow_WhenFileAlreadyMissing));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "X", HeaderImageUrl = "/media/hero.png?v=1" });
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        await svc.DeleteHeroAsync();

        BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
        Assert.Null(brand.HeaderImageUrl);
    }

    [Fact]
    public async Task UploadLocationAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadLocationAsync_ReturnsNull_WhenRestaurantNotFound));
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1]);

        string? url = await svc.UploadLocationAsync(999, stream, "image/png");

        Assert.Null(url);
    }

    [Fact]
    public async Task UploadLocationAsync_WritesFileAndUpdatesRestaurant()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadLocationAsync_WritesFileAndUpdatesRestaurant));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC" };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1, 2]);

        string? url = await svc.UploadLocationAsync(restaurant.Id, stream, "image/webp");

        Assert.NotNull(url);
        Assert.StartsWith($"/media/location-{restaurant.Id}.webp?v=", url);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.webp")));
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Equal(url, reloaded.ImageUrl);
    }

    [Fact]
    public async Task UploadLocationAsync_RemovesPreviousLocationFiles()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadLocationAsync_RemovesPreviousLocationFiles));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC" };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using (var first = new MemoryStream([1]))
            await svc.UploadLocationAsync(restaurant.Id, first, "image/jpeg");
        Assert.True(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.jpg")));

        using var second = new MemoryStream([2]);
        await svc.UploadLocationAsync(restaurant.Id, second, "image/png");

        Assert.False(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.jpg")));
        Assert.True(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.png")));
    }

    [Fact]
    public async Task DeleteLocationAsync_ReturnsFalse_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteLocationAsync_ReturnsFalse_WhenRestaurantNotFound));
        MediaService svc = CreateService(db);

        bool result = await svc.DeleteLocationAsync(999);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteLocationAsync_ReturnsTrue_WhenImageUrlAlreadyNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteLocationAsync_ReturnsTrue_WhenImageUrlAlreadyNull));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC", ImageUrl = null };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        bool result = await svc.DeleteLocationAsync(restaurant.Id);

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteLocationAsync_ClearsReferenceAndDeletesFile()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteLocationAsync_ClearsReferenceAndDeletesFile));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC" };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using (var stream = new MemoryStream([1]))
            await svc.UploadLocationAsync(restaurant.Id, stream, "image/png");
        Assert.True(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.png")));

        bool result = await svc.DeleteLocationAsync(restaurant.Id);

        Assert.True(result);
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Null(reloaded.ImageUrl);
        Assert.False(File.Exists(Path.Combine(MediaDir, $"location-{restaurant.Id}.png")));
    }

    [Fact]
    public async Task DeleteHeroAsync_IsBestEffort_WhenStoredPathIsUnreadable()
    {
        // The stored URL points at a path that is itself a directory, so File.Delete
        // throws inside TryDeleteFile's try block — proving the catch swallows it
        // (the DB reference is still cleared, and the call does not throw).
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_IsBestEffort_WhenStoredPathIsUnreadable));
        Directory.CreateDirectory(MediaDir);
        Directory.CreateDirectory(Path.Combine(MediaDir, "hero.png"));
        db.Set<BrandSettings>().Add(new BrandSettings { AppName = "X", HeaderImageUrl = "/media/hero.png?v=1" });
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        await svc.DeleteHeroAsync();

        BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
        Assert.Null(brand.HeaderImageUrl);
    }

    [Fact]
    public async Task DeleteHeroAsync_SwallowsException_WhenFileIsImmutable()
    {
        // File.Exists reports true for a directory-shaped or embedded-NUL path too, but
        // File.Delete is never reached in those cases (File.Exists itself returns false for
        // them) — so neither actually exercises TryDeleteFile's catch. chattr +i marks a real
        // file immutable at the filesystem level (enforced even for root), so File.Exists
        // sees a real file but File.Delete genuinely throws.
        Directory.CreateDirectory(MediaDir);
        string filePath = Path.Combine(MediaDir, "hero.png");
        await File.WriteAllBytesAsync(filePath, [1, 2, 3]);

        // chattr +i (immutable) requires a filesystem that supports the ext2/3/4 attribute
        // (e.g. tmpfs/overlayfs do not) and the chattr binary. Skip gracefully rather than
        // fail the build on a CI environment where the temp dir doesn't support it.
        if (!await TryRunChattrAsync("+i", filePath))
        {
            return;
        }

        try
        {
            using AppDbContext db = TestDbFactory.Create(nameof(DeleteHeroAsync_SwallowsException_WhenFileIsImmutable));
            db.Set<BrandSettings>().Add(new BrandSettings { AppName = "X", HeaderImageUrl = "/media/hero.png?v=1" });
            await db.SaveChangesAsync();
            MediaService svc = CreateService(db);

            Exception? ex = await Record.ExceptionAsync(() => svc.DeleteHeroAsync());

            Assert.Null(ex);
            BrandSettings brand = await db.Set<BrandSettings>().SingleAsync();
            Assert.Null(brand.HeaderImageUrl);
            Assert.True(File.Exists(filePath), "the immutable file must survive the failed delete");
        }
        finally
        {
            // Clear the immutable flag so MediaServiceTests.Dispose can clean up _tempRoot.
            await TryRunChattrAsync("-i", filePath);
        }
    }

    private static async Task<bool> TryRunChattrAsync(string flag, string filePath)
    {
        try
        {
            using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "chattr",
                ArgumentList = { flag, filePath },
                RedirectStandardError = true,
                UseShellExecute = false,
            })!;
            await process.WaitForExitAsync();
            return process.ExitCode == 0;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // chattr binary not found.
            return false;
        }
    }

    [Fact]
    public async Task UploadMenuAsync_ReturnsNull_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadMenuAsync_ReturnsNull_WhenRestaurantNotFound));
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1]);

        string? url = await svc.UploadMenuAsync(999, stream);

        Assert.Null(url);
    }

    [Fact]
    public async Task UploadMenuAsync_WritesFileAndUpdatesRestaurant()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadMenuAsync_WritesFileAndUpdatesRestaurant));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC" };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using var stream = new MemoryStream([1, 2]);

        string? url = await svc.UploadMenuAsync(restaurant.Id, stream);

        Assert.NotNull(url);
        Assert.StartsWith($"/media/menu-{restaurant.Id}.pdf?v=", url);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"menu-{restaurant.Id}.pdf")));
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Equal(url, reloaded.MenuUrl);
    }

    [Fact]
    public async Task UploadMenuAsync_OverwritesPreviousUploadAndExternalLink()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(UploadMenuAsync_OverwritesPreviousUploadAndExternalLink));
        var restaurant = new Restaurant
        {
            Name = "R",
            Address = "A",
            Timezone = "UTC",
            MenuUrl = "https://example.com/external-menu.pdf",
        };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        using var first = new MemoryStream([1]);
        await svc.UploadMenuAsync(restaurant.Id, first);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"menu-{restaurant.Id}.pdf")));

        // A second upload replaces the first file on disk and the MenuUrl column.
        using var second = new MemoryStream([2]);
        string? url = await svc.UploadMenuAsync(restaurant.Id, second);

        Assert.NotNull(url);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"menu-{restaurant.Id}.pdf")));
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Equal(url, reloaded.MenuUrl);
    }

    [Fact]
    public async Task DeleteMenuAsync_ReturnsFalse_WhenRestaurantNotFound()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteMenuAsync_ReturnsFalse_WhenRestaurantNotFound));
        MediaService svc = CreateService(db);

        bool result = await svc.DeleteMenuAsync(999);

        Assert.False(result);
    }

    [Fact]
    public async Task DeleteMenuAsync_ReturnsTrue_WhenMenuUrlAlreadyNull()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteMenuAsync_ReturnsTrue_WhenMenuUrlAlreadyNull));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC", MenuUrl = null };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        bool result = await svc.DeleteMenuAsync(restaurant.Id);

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteMenuAsync_ClearsReferenceAndDeletesFile()
    {
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteMenuAsync_ClearsReferenceAndDeletesFile));
        var restaurant = new Restaurant { Name = "R", Address = "A", Timezone = "UTC" };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);
        using (var stream = new MemoryStream([1]))
            await svc.UploadMenuAsync(restaurant.Id, stream);
        Assert.True(File.Exists(Path.Combine(MediaDir, $"menu-{restaurant.Id}.pdf")));

        bool result = await svc.DeleteMenuAsync(restaurant.Id);

        Assert.True(result);
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Null(reloaded.MenuUrl);
        Assert.False(File.Exists(Path.Combine(MediaDir, $"menu-{restaurant.Id}.pdf")));
    }

    [Fact]
    public async Task DeleteMenuAsync_ClearsExternalLinkWithoutTouchingDisk()
    {
        // An external link isn't backed by a file under _mediaDir; DeleteMenuAsync must
        // still clear the column (no-op disk delete) and not throw.
        using AppDbContext db = TestDbFactory.Create(nameof(DeleteMenuAsync_ClearsExternalLinkWithoutTouchingDisk));
        var restaurant = new Restaurant
        {
            Name = "R",
            Address = "A",
            Timezone = "UTC",
            MenuUrl = "https://example.com/external-menu.pdf",
        };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        MediaService svc = CreateService(db);

        bool result = await svc.DeleteMenuAsync(restaurant.Id);

        Assert.True(result);
        Restaurant reloaded = await db.Restaurants.SingleAsync(r => r.Id == restaurant.Id);
        Assert.Null(reloaded.MenuUrl);
    }
}
