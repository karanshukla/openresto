using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class AvailabilityControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetAvailability_ReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        int restaurantId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            restaurantId = db.Restaurants.First().Id;
        }

        var date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/availability/{restaurantId}?date={date}&seats=2");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<AvailabilityResponseDto>();
        Assert.NotNull(result);
        Assert.Equal(restaurantId, result.RestaurantId);
        Assert.NotEmpty(result.Slots);
    }

    [Fact]
    public async Task GetAvailability_NotFound_Returns404()
    {
        HttpClient client = _factory.CreateClient();
        var date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        var response = await client.GetAsync($"/api/availability/9999?date={date}&seats=2");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
