using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Tests.Infrastructure;

/// <summary>
/// The runtime half is trivial by design (see the attribute's own doc comment) — these two cases
/// just pin that it never blocks either a JWT session or an API key, which is what makes it safe
/// to place on <c>ApiKeysController.Self</c>. <see cref="ApiKeyScopeCoverageTests"/> covers the
/// structural half.
/// </summary>
public class AllowAnyApiKeyAttributeTests
{
    private static AuthorizationFilterContext ContextFor(ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        return new AuthorizationFilterContext(actionContext, []);
    }

    [Fact]
    public void OnAuthorization_AllowsAJwtSession()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, UserRoles.Owner)],
            authenticationType: Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme));
        var attribute = new AllowAnyApiKeyAttribute();
        AuthorizationFilterContext context = ContextFor(principal);

        attribute.OnAuthorization(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void OnAuthorization_AllowsAnApiKeySession_RegardlessOfItsScopes()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [],
            authenticationType: ApiKeyClaimTypes.Scheme));
        var attribute = new AllowAnyApiKeyAttribute();
        AuthorizationFilterContext context = ContextFor(principal);

        attribute.OnAuthorization(context);

        Assert.Null(context.Result);
    }
}
