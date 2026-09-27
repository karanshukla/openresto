using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (!db.Restaurants.Any())
        {
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

        SeedHighlights(db);
    }

    private static void SeedHighlights(AppDbContext db)
    {
        if (db.Highlights.Any())
        {
            return;
        }

        db.Highlights.AddRange(
            new RestaurantHighlight
            {
                Title = "Wood-fired kitchen",
                Body = "Our signature dishes are prepared fresh daily using time-honoured techniques.",
                IconKey = "flame-outline",
                SortOrder = 0,
            },
            new RestaurantHighlight
            {
                Title = "Live music evenings",
                Body = "Resident performers every Thursday and Friday from 7pm. No cover charge.",
                IconKey = "musical-notes-outline",
                SortOrder = 1,
            },
            new RestaurantHighlight
            {
                Title = "Private dining up to 24",
                Body = "Semi-private rooms with custom menus. Perfect for celebrations and corporate events.",
                IconKey = "people-outline",
                SortOrder = 2,
            },
            new RestaurantHighlight
            {
                Title = "Family recipes since 1982",
                Body = "Three generations of the same family. Same kitchen, same hands, same recipes.",
                IconKey = "heart-outline",
                SortOrder = 3,
            }
        );
        db.SaveChanges();
    }
}
