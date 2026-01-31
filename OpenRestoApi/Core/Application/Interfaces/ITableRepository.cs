namespace OpenRestoApi.Core.Application.Interfaces;

using OpenRestoApi.Core.Domain;
public interface TableRepository
{
    Task<IEnumerable<Table>> GetAllTablesAsync();
    Task<Table?> GetTableByIdAsync(int id);
    Task<IEnumerable<Table>> GetTablesByRestaurantIdAsync(int restaurantId);
}