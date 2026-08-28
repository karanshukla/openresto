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

public class NoApiKeyAccessAttributeTests
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
        var attribute = new NoApiKeyAccessAttribute();
        AuthorizationFilterContext context = ContextFor(principal);

        attribute.OnAuthorization(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void OnAuthorization_RejectsAnApiKeySession_RegardlessOfItsScopes()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ApiKeyClaimTypes.Scope, $"{ApiKeyScopes.Bookings}:{ApiKeyScopes.Write}")],
            authenticationType: ApiKeyClaimTypes.Scheme));
        var attribute = new NoApiKeyAccessAttribute();
        AuthorizationFilterContext context = ContextFor(principal);

        attribute.OnAuthorization(context);

        ObjectResult result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        var body = Assert.IsType<MessageResponse>(result.Value);
        Assert.Equal(ErrorCodes.ApiKeyNotAllowed, body.Code);
    }
}
