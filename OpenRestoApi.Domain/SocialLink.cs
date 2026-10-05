namespace OpenRestoApi.Core.Domain;

public class SocialLink
{
    public int Id { get; set; }
    public string Label { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string IconKey { get; set; } = "link-outline";
    public int SortOrder { get; set; }
}
