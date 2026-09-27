namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// Holds the files admins upload (the homepage header image, location photos, menus), which the
/// site serves from <c>/media/</c>. Each upload fills a slot such as <c>hero</c> or
/// <c>location-3</c>, and a slot holds one file at a time.
/// </summary>
public interface IMediaStore
{
    /// <summary>
    /// Stores <paramref name="content"/> as <c>&lt;slot&gt;.&lt;extension&gt;</c>, removing whatever the
    /// slot held before under any extension, and returns the stored file's name.
    /// </summary>
    Task<string> ReplaceAsync(string slot, string extension, Stream content);

    /// <summary>Deletes the named file if it exists. Never throws.</summary>
    void TryDelete(string fileName);
}
