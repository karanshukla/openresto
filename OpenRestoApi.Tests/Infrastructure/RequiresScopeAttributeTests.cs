using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Infrastructure.Auth;

namespace OpenRestoApi.Tests.Infrastructure;

public class RequiresScopeAttributeTests
{
    private static AuthorizationFilterContext ContextFor(ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        return new AuthorizationFilterContext(actionContext, []);
    }

    private static ClaimsPrincipal JwtSession(string role = UserRoles.Owner)
        => new(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, role)],
            authenticationType: Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme));

    private static ClaimsPrincipal ApiKeySession(params (string Resource, string Access)[] scopes)
        => new(new ClaimsIdentity(
            scopes.Select(s => new Claim(ApiKeyClaimTypes.Scope, $"{s.Resource}:{s.Access}")),
            authenticationType: ApiKeyClaimTypes.Scheme));

    [Fact]
    public void OnAuthorization_IgnoresAJwtSession_RegardlessOfScope()
    {
        var attribute = new RequiresScopeAttribute(ApiKeyScopes.Bookings, ApiKeyScopes.Write);
        AuthorizationFilterContext context = ContextFor(JwtSession());

        attribute.OnAuthorization(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void OnAuthorization_AllowsAnApiKeyCarryingTheRequiredScope()
    {
        var attribute = new RequiresScopeAttribute(ApiKeyScopes.Bookings, ApiKeyScopes.Write);
        AuthorizationFilterContext context = ContextFor(ApiKeySession((ApiKeyScopes.Bookings, ApiKeyScopes.Write)));

        attribute.OnAuthorization(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void OnAuthorization_RejectsAnApiKeyMissingTheRequiredScope()
    {
        var attribute = new RequiresScopeAttribute(ApiKeyScopes.Bookings, ApiKeyScopes.Write);
        AuthorizationFilterContext context = ContextFor(ApiKeySession((ApiKeyScopes.Bookings, ApiKeyScopes.Read)));

        attribute.OnAuthorization(context);

        ObjectResult result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        var body = Assert.IsType<MessageResponse>(result.Value);
        Assert.Equal(ErrorCodes.ApiKeyScopeMissing, body.Code);
    }

    [Fact]
    public void OnAuthorization_RejectsAnApiKeyWithNoScopesAtAll()
    {
        var attribute = new RequiresScopeAttribute(ApiKeyScopes.Bookings, ApiKeyScopes.Read);
        AuthorizationFilterContext context = ContextFor(ApiKeySession());

        attribute.OnAuthorization(context);

        Assert.IsType<ObjectResult>(context.Result);
    }
}
