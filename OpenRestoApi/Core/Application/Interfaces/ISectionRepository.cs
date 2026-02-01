using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface ISectionRepository
{
    Task<Section?> GetByIdAsync(int id);
}
