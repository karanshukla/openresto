using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Infrastructure.Persistence;

/// <summary>
/// First-run creation of the initial Owner account. This is the <em>only</em> place an account
/// is conjured from configuration — the auth services used to each carry their own copy of this
/// logic, which quietly meant "log in as an email nobody has registered and the instance invents
/// the account for you". Login now looks accounts up, so the bootstrap belongs at startup and
/// nowhere else.
/// </summary>
public static class AdminBootstrap
{
    /// <summary>
    /// Creates the initial Owner from <c>Admin:Email</c>/<c>Admin:Password</c> (falling back to the
    /// <c>ADMIN_EMAIL</c>/<c>ADMIN_PASSWORD</c> env vars) when no account exists yet. No-op once any
    /// account is present, so an upgraded single-admin instance keeps its existing row — which the
    /// migration has already stamped as an Owner.
    /// </summary>
    public static void EnsureInitialOwner(AppDbContext db, IConfiguration configuration, IPasswordService passwordService)
    {
        if (db.AdminCredentials.Any())
        {
            return;
        }

        string? configEmail = configuration["Admin:Email"];
        string email = !string.IsNullOrWhiteSpace(configEmail)
            ? configEmail
            : Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@openresto.com";

        string? configPassword = configuration["Admin:Password"];
        string? password = !string.IsNullOrWhiteSpace(configPassword)
            ? configPassword
            : Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InfrastructureException(
                "Admin:Password must be configured before first use. Set it via ADMIN_PASSWORD env var.")
            { Code = ErrorCodes.AdminPasswordNotConfigured };
        }

        (string hash, string salt) = passwordService.Hash(password);
        db.AdminCredentials.Add(new AdminCredential
        {
            Email = email.Trim().ToLowerInvariant(),
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = UserRoles.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }
}
