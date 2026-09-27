namespace OpenRestoApi.Core.Application.DTOs;

public class SocialLinkDto
{
    public int Id { get; set; }
    public string Label { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string IconKey { get; set; } = "link-outline";
    public int SortOrder { get; set; }
}

public class CreateSocialLinkRequest
{
    public string Label { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string IconKey { get; set; } = "link-outline";
    public int SortOrder { get; set; }
}

public class UpdateSocialLinkRequest
{
    public string Label { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string IconKey { get; set; } = "link-outline";
    public int SortOrder { get; set; }
}
