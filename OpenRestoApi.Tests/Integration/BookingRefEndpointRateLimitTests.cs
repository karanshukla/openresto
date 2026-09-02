using System.Reflection;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;
using OpenRestoApi.Controllers;
using OpenRestoApi.Extensions;

namespace OpenRestoApi.Tests.Integration;

/// <summary>
/// Guest booking references are guessable secrets with no account behind them, so the two
/// endpoints that accept one are throttled far harder than the browsing endpoints they sit
/// beside. The policy is an attribute on those two actions, which is exactly the kind of thing a
/// refactor drops silently — hence a structural assertion rather than a hand-checked list.
/// </summary>
public class BookingRefEndpointRateLimitTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    private static readonly string[] _byRefGuestActions =
    [
        nameof(BookingsController.GetBookingByRef),
        nameof(BookingsController.CancelBookingByRef),
        nameof(BookingsController.SubscribeReminders),
        nameof(BookingsController.UnsubscribeReminders),
        nameof(BookingsController.GetAppleWalletPass),
        nameof(BookingsController.GetGoogleWalletLink)
    ];

    private static IEnumerable<MethodInfo> ControllerActions() =>
        typeof(BookingsController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes().OfType<IActionHttpMethodProvider>().Any());

    private static string? PolicyOn(MethodInfo action) =>
        action.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName;

    [Fact]
    public void ByRefGuestActions_CarryTheTightLookupPolicy()
    {
        List<MethodInfo> byRef = [.. ControllerActions().Where(m => _byRefGuestActions.Contains(m.Name))];

        Assert.Equal(_byRefGuestActions.Length, byRef.Count);
        Assert.All(byRef, action => Assert.Equal("booking-lookup", PolicyOn(action)));
    }

    [Fact]
    public void EveryOtherBookingsAction_StaysOnThePublicBrowsingPolicy()
    {
        // The tight ceiling is for the guessable-secret surface only. Applying it to the whole
        // controller would throttle ordinary booking traffic to ten requests a minute per address.
        List<MethodInfo> others = [.. ControllerActions().Where(m => !_byRefGuestActions.Contains(m.Name))];

        Assert.NotEmpty(others);
        Assert.All(others, action => Assert.Null(PolicyOn(action)));
        Assert.Equal("public", typeof(BookingsController).GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
    }

    [Fact]
    public async Task TheLookupPolicyIsRegisteredWithTheLimiter()
    {
        // An [EnableRateLimiting] naming a policy no AddPolicy call registered throws only once a
        // request reaches the endpoint — a 500 from a typo, not a startup failure. So drive one.
        Assert.Equal(ServiceCollectionExtensions.BookingLookupPolicy,
            PolicyOn(typeof(BookingsController).GetMethod(nameof(BookingsController.GetBookingByRef))!));

        HttpResponseMessage response = await _factory.CreateClient()
            .GetAsync("/api/bookings/ref/policy-registration-probe?email=nobody@test.com");

        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }
}
