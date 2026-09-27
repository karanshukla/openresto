using CustomAccessibility.Attributes;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Media;

/// <summary>
/// Keeps uploads in <c>wwwroot/media</c> under the content root, the directory nginx serves at
/// <c>/media/</c> and the <c>media_data</c> volume is mounted on.
/// </summary>
[OnlyAccessibleBy("OpenRestoApi.Extensions.ServiceCollectionExtensions")]
[OnlyAccessibleBy("OpenRestoApi.Tests.Services.MediaServiceTests")]
[ExternalAccessAllowed]
internal sealed class MediaStore(IHostEnvironment env) : IMediaStore
{
    private readonly string _mediaDir = Path.Combine(env.ContentRootPath, "wwwroot", "media");

    public async Task<string> ReplaceAsync(string slot, string extension, Stream content)
    {
        Directory.CreateDirectory(_mediaDir);
        foreach (string old in Directory.GetFiles(_mediaDir, $"{slot}.*"))
            File.Delete(old);

        string fileName = $"{slot}.{extension}";
        await using (FileStream dest = File.Create(Path.Combine(_mediaDir, fileName)))
            await content.CopyToAsync(dest);
        return fileName;
    }

    public void TryDelete(string fileName)
    {
        try
        {
            string path = Path.Combine(_mediaDir, Path.GetFileName(fileName));
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // Intentionally ignored: callers clear the stored reference first, so a stray or
            // invalid file must not fail the removal.
        }
    }
}
