using System.Linq;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Restaurants.Any())
        {
            return;
        }

        var r1 = new Restaurant
        {
            Name = "Pasta Place",
            Address = "123 Main St",
            Sections = new List<Section>
            {
                new Section
                {
                    Name = "Indoor",
                    Tables = new List<Table>
                    {
                        new Table { Name = "T1", Seats = 4 },
                        new Table { Name = "T2", Seats = 2 }
                    }
                },
                new Section
                {
                    Name = "Patio",
                    Tables = new List<Table>
                    {
                        new Table { Name = "P1", Seats = 4 }
                    }
                }
            }
        };

        var r2 = new Restaurant
        {
            Name = "Sushi Spot",
            Address = "456 Elm St",
            Sections = new List<Section>
            {
                new Section
                {
                    Name = "Bar",
                    Tables = new List<Table>
                    {
                        new Table { Name = "B1", Seats = 2 },
                        new Table { Name = "B2", Seats = 2 }
                    }
                }
            }
        };

        db.Restaurants.AddRange(r1, r2);
        db.SaveChanges();
    }
}
