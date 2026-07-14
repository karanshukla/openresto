using System.ComponentModel.DataAnnotations;

namespace OpenRestoApi.Core.Domain;

public class RestaurantHighlight
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string IconKey { get; set; } = "star-outline";
    public int SortOrder { get; set; }

    /// <summary>
    /// Optional URL the highlight links to from the home page. Null/empty renders the
    /// highlight as a plain (non-clickable) card, exactly as it did before this field existed.
    /// </summary>
    [StringLength(500)]
    public string? Link { get; set; }
}
