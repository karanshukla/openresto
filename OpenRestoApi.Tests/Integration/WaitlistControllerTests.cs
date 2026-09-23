using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using OpenRestoApi.Controllers;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;
using OpenRestoApi.Infrastructure.Persistence;

namespace OpenRestoApi.Tests.Integration;

public class WaitlistControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private int SeedRestaurant(bool walkInOnly)
    {
        using IServiceScope scope = _factory.Services.CreateScope();
        AppDbContext db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var restaurant = new Restaurant { Name = "Waitlist Door", WalkInOnly = walkInOnly };
        restaurant.Sections.Add(new Section { Name = "Main", Tables = new List<Table> { new() { Name = "T1", Seats = 4 } } });
        db.Restaurants.Add(restaurant);
        db.SaveChanges();
        return restaurant.Id;
    }

    [Fact]
    public void Join_CarriesTheTightLookupPolicy()
    {
        MethodInfo join = typeof(WaitlistController).GetMethod(nameof(WaitlistController.Join))!;

        Assert.Equal("booking-lookup", join.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
        Assert.Equal("public", typeof(WaitlistController).GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
    }

    [Fact]
    public async Task Join_Returns409_AtALocationThatTakesBookings()
    {
        int id = SeedRestaurant(walkInOnly: false);

        HttpResponseMessage response = await _factory.CreateClient()
            .PostAsJsonAsync($"/api/restaurants/{id}/waitlist", new { name = "Ada", seats = 2 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        MessageResponse? body = await response.Content.ReadFromJsonAsync<MessageResponse>();
        Assert.Equal(ErrorCodes.WaitlistNotWalkInNow, body!.Code);
    }

    [Fact]
    public async Task GetQuote_SaysWhetherGuestsCanJoin()
    {
        int id = SeedRestaurant(walkInOnly: false);

        WaitlistQuoteDto? quote = await _factory.CreateClient().GetFromJsonAsync<WaitlistQuoteDto>($"/api/restaurants/{id}/waitlist?seats=2");

        Assert.False(quote!.AcceptingGuests);
        Assert.Equal(0, quote.EstimatedWaitMinutes);
    }

    [Fact]
    public async Task GetStatus_Returns404_ForAnUnknownRef()
    {
        HttpResponseMessage response = await _factory.CreateClient().GetAsync("/api/waitlist/unknown-ref");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Leave_Returns404_ForAnUnknownRef()
    {
        HttpResponseMessage response = await _factory.CreateClient().PostAsync("/api/waitlist/unknown-ref/leave", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Board_Returns401_WithoutAuth()
    {
        int id = SeedRestaurant(walkInOnly: true);

        HttpResponseMessage response = await _factory.CreateClient().GetAsync($"/api/admin/restaurants/{id}/waitlist");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task StaffFlow_AddsCallsAndSeatsAParty()
    {
        int id = SeedRestaurant(walkInOnly: false);
        HttpClient client = _factory.CreateAuthenticatedClient();

        HttpResponseMessage added = await client.PostAsJsonAsync($"/api/admin/restaurants/{id}/waitlist", new { name = "Ada", seats = 3 });
        Assert.Equal(HttpStatusCode.Created, added.StatusCode);
        WaitlistEntryDto entry = (await added.Content.ReadFromJsonAsync<WaitlistEntryDto>())!;
        Assert.True(entry.CanSeatNow);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/admin/waitlist/{entry.Id}/notify", null)).StatusCode);

        WaitlistBoardDto board = (await client.GetFromJsonAsync<WaitlistBoardDto>($"/api/admin/restaurants/{id}/waitlist"))!;
        Assert.Equal("notified", Assert.Single(board.Entries).Status);

        HttpResponseMessage seated = await client.PostAsJsonAsync($"/api/admin/waitlist/{entry.Id}/seat", new { });
        Assert.Equal(HttpStatusCode.OK, seated.StatusCode);
        SeatWaitlistEntryResponse result = (await seated.Content.ReadFromJsonAsync<SeatWaitlistEntryResponse>())!;
        Assert.Equal("seated", result.Entry.Status);
        Assert.False(string.IsNullOrEmpty(result.BookingRef));

        board = (await client.GetFromJsonAsync<WaitlistBoardDto>($"/api/admin/restaurants/{id}/waitlist"))!;
        Assert.Empty(board.Entries);
    }

    [Fact]
    public async Task Remove_TakesThePartyOffTheBoard()
    {
        int id = SeedRestaurant(walkInOnly: false);
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage added = await client.PostAsJsonAsync($"/api/admin/restaurants/{id}/waitlist", new { name = "Bo", seats = 2 });
        WaitlistEntryDto entry = (await added.Content.ReadFromJsonAsync<WaitlistEntryDto>())!;

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/admin/waitlist/{entry.Id}/remove", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/admin/waitlist/{entry.Id}/remove", null)).StatusCode);
    }
}
