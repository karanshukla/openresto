using System.Reflection;

namespace OpenRestoApi.Core.Application.Utilities;

/// <summary>
/// The server's own version, as set by <c>&lt;Version&gt;</c> in OpenRestoApi.csproj and served
/// by <c>GET /api/version</c> for the CLI's server/CLI mismatch check (issue #404). Read from
/// <see cref="AssemblyInformationalVersionAttribute"/> rather than the assembly's four-part
/// <c>Version</c> (which pads/truncates and isn't meant as display text): the SDK appends
/// "+&lt;git-commit-sha&gt;" to InformationalVersion automatically for a git checkout, so that
/// suffix is stripped to return exactly the csproj version.
/// </summary>
public static class AppVersion
{
    public static string Current { get; } = Resolve();

    private static string Resolve()
    {
        string? informational = typeof(AppVersion).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion;

        if (string.IsNullOrEmpty(informational))
        {
            return "0.0.0";
        }

        int plusIndex = informational.IndexOf('+', StringComparison.Ordinal);
        return plusIndex >= 0 ? informational[..plusIndex] : informational;
    }
}
