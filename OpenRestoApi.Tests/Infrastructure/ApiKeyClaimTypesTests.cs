using System.Security.Claims;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Tests.Infrastructure;

public class ApiKeyClaimTypesTests
{
    private static ClaimsPrincipal ApiKeySession(params (string Resource, string Access)[] scopes)
        => new(new ClaimsIdentity(
            scopes.Select(s => new Claim(ApiKeyClaimTypes.Scope, $"{s.Resource}:{s.Access}")),
            authenticationType: ApiKeyClaimTypes.Scheme));

    [Fact]
    public void HasScope_ExactMatchIsSatisfied()
    {
        ClaimsPrincipal user = ApiKeySession((ApiKeyScopes.Bookings, ApiKeyScopes.Read));

        Assert.True(user.HasScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read));
    }

    [Fact]
    public void HasScope_WriteScopeSatisfiesAReadRequirement()
    {
        ClaimsPrincipal user = ApiKeySession((ApiKeyScopes.Bookings, ApiKeyScopes.Write));

        Assert.True(user.HasScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read));
    }

    [Fact]
    public void HasScope_ReadScopeDoesNotSatisfyAWriteRequirement()
    {
        ClaimsPrincipal user = ApiKeySession((ApiKeyScopes.Bookings, ApiKeyScopes.Read));

        Assert.False(user.HasScope(ApiKeyScopes.Bookings, ApiKeyScopes.Write));
    }

    [Fact]
    public void HasScope_DoesNotBleedAcrossResources()
    {
        ClaimsPrincipal user = ApiKeySession((ApiKeyScopes.Locations, ApiKeyScopes.Write));

        Assert.False(user.HasScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read));
    }

    [Fact]
    public void HasScope_NoScopesAtAllSatisfiesNothing()
    {
        ClaimsPrincipal user = ApiKeySession();

        Assert.False(user.HasScope(ApiKeyScopes.Bookings, ApiKeyScopes.Read));
    }

    [Fact]
    public void IsApiKeyAuthenticated_TrueForTheApiKeyScheme()
    {
        ClaimsPrincipal user = ApiKeySession();

        Assert.True(user.IsApiKeyAuthenticated());
    }

    [Fact]
    public void IsApiKeyAuthenticated_FalseForAJwtSession()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [],
            authenticationType: Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme));

        Assert.False(user.IsApiKeyAuthenticated());
    }
}
