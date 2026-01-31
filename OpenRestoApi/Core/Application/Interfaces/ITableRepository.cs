using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

public interface ITableRepository
{
    Task<Table?> GetByIdAsync(int id);
}
