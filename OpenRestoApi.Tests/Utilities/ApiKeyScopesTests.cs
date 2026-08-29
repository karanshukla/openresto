using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class ApiKeyScopesTests
{
    [Theory]
    [InlineData(ApiKeyScopes.Audit, ApiKeyScopes.Read)]
    [InlineData(ApiKeyScopes.Guests, ApiKeyScopes.Read)]
    [InlineData(ApiKeyScopes.Email, ApiKeyScopes.Read)]
    public void IsValid_AcceptsReadOnAReadOnlyResource(string resource, string access)
        => Assert.True(ApiKeyScopes.IsValid(resource, access));

    [Theory]
    [InlineData(ApiKeyScopes.Audit, ApiKeyScopes.Write)]
    [InlineData(ApiKeyScopes.Guests, ApiKeyScopes.Write)]
    public void IsValid_RejectsWriteOnAReadOnlyResource(string resource, string access)
        => Assert.False(ApiKeyScopes.IsValid(resource, access));

    /// <summary>
    /// Its own test rather than another InlineData row: a key that could write the SMTP settings
    /// could point every outgoing mail at a relay it controls, so email:write staying unmintable
    /// is a security boundary rather than an "this resource happens to have no write endpoint".
    /// </summary>
    [Fact]
    public void IsValid_RejectsEmailWrite()
        => Assert.False(ApiKeyScopes.IsValid(ApiKeyScopes.Email, ApiKeyScopes.Write));

    [Theory]
    [InlineData(ApiKeyScopes.Bookings, ApiKeyScopes.Write)]
    [InlineData(ApiKeyScopes.Locations, ApiKeyScopes.Write)]
    [InlineData(ApiKeyScopes.Tables, ApiKeyScopes.Write)]
    [InlineData(ApiKeyScopes.Brand, ApiKeyScopes.Write)]
    [InlineData(ApiKeyScopes.Users, ApiKeyScopes.Write)]
    public void IsValid_AcceptsWriteOnAWritableResource(string resource, string access)
        => Assert.True(ApiKeyScopes.IsValid(resource, access));

    [Fact]
    public void IsValid_RejectsAnUnknownResource()
        => Assert.False(ApiKeyScopes.IsValid("recipes", ApiKeyScopes.Read));

    [Fact]
    public void IsValid_RejectsAnUnknownAccessLevel()
        => Assert.False(ApiKeyScopes.IsValid(ApiKeyScopes.Bookings, "admin"));

    [Fact]
    public void IsValid_RejectsNullResourceOrAccess()
    {
        Assert.False(ApiKeyScopes.IsValid(null, ApiKeyScopes.Read));
        Assert.False(ApiKeyScopes.IsValid(ApiKeyScopes.Bookings, null));
    }
}
