using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class TonightControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private (int RestaurantId, int SmallTableId, int LargeTableId) SeedRestaurant()
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var small = new Table { Name = "T1", Seats = 4 };
        var large = new Table { Name = "T2", Seats = 6 };
        var restaurant = new Restaurant { Name = "Host Stand", OpenTime = "00:00", CloseTime = "23:59" };
        restaurant.Sections.Add(new Section { Name = "Main", Tables = [small, large] });
        db.Restaurants.Add(restaurant);
        db.SaveChanges();
        return (restaurant.Id, small.Id, large.Id);
    }

    [Fact]
    public async Task Get_Returns401_WithoutAuth()
    {
        (int id, _, _) = SeedRestaurant();

        HttpResponseMessage response = await _factory.CreateClient().GetAsync($"/api/admin/restaurants/{id}/tonight");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_Returns404_ForAnUnknownLocation()
    {
        HttpResponseMessage response = await _factory.CreateAuthenticatedClient().GetAsync("/api/admin/restaurants/99999/tonight");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SeatingAWaitlistPartyOnAChosenTile_ShowsThatTileSeated()
    {
        (int id, int small, int large) = SeedRestaurant();
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage added = await client.PostAsJsonAsync($"/api/admin/restaurants/{id}/waitlist", new { name = "Ada", seats = 2 });
        WaitlistEntryDto entry = (await added.Content.ReadFromJsonAsync<WaitlistEntryDto>())!;

        TonightDto before = (await client.GetFromJsonAsync<TonightDto>($"/api/admin/restaurants/{id}/tonight"))!;
        Assert.Equal(entry.Id, Assert.Single(before.Waitlist.Entries).Id);
        Assert.All(before.Sections.SelectMany(s => s.Units), u => Assert.Equal("free", u.State));

        HttpResponseMessage seated = await client.PostAsJsonAsync($"/api/admin/waitlist/{entry.Id}/seat", new { tableId = large });
        Assert.Equal(HttpStatusCode.OK, seated.StatusCode);

        TonightDto after = (await client.GetFromJsonAsync<TonightDto>($"/api/admin/restaurants/{id}/tonight"))!;
        List<FloorUnitDto> units = after.Sections.SelectMany(s => s.Units).ToList();
        FloorUnitDto largeTile = units.Single(u => u.Id == large);
        Assert.Equal("seated", largeTile.State);
        Assert.Equal("free", units.Single(u => u.Id == small).State);
        BookingDetailDto booking = Assert.Single(after.Bookings);
        Assert.Equal(largeTile.CurrentBookingId, booking.Id);
        Assert.Equal("Seated", booking.Status);
        Assert.Empty(after.Waitlist.Entries);
    }
}
