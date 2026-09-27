using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Persistence of <see cref="SocialLink"/> rows (the footer social icons).</summary>
public interface ISocialLinkRepository
{
    /// <summary>All links ordered by SortOrder then Id.</summary>
    Task<List<SocialLink>> GetAllAsync();

    /// <summary>Looks up a single link by id (no navigation properties).</summary>
    Task<SocialLink?> FindByIdAsync(int id);

    /// <summary>Adds and saves a link, returning the persisted entity.</summary>
    Task<SocialLink> AddAsync(SocialLink link);

    /// <summary>Flushes pending changes on a tracked entity.</summary>
    Task SaveChangesAsync();

    /// <summary>Removes a link (caller has already loaded it).</summary>
    void Remove(SocialLink link);
}
