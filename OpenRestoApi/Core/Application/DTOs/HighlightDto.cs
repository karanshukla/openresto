namespace OpenRestoApi.Core.Application.DTOs;

public class HighlightDto
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string IconKey { get; set; } = "star-outline";
    public int SortOrder { get; set; }
    public string? Link { get; set; }
}

public class CreateHighlightRequest
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string IconKey { get; set; } = "star-outline";
    public int SortOrder { get; set; }
    public string? Link { get; set; }
}

public class UpdateHighlightRequest
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string IconKey { get; set; } = "star-outline";
    public int SortOrder { get; set; }
    public string? Link { get; set; }
}
