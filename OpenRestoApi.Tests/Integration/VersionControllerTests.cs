using System.Net;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Xml.Linq;
using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Integration;

public class VersionControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetVersion_WithoutAuth_ReturnsOkWithTheCsprojVersion()
    {
        HttpClient client = _factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/api/version");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(CsprojVersion(), body.GetProperty("version").GetString());
    }

    /// <summary>
    /// Pins that <see cref="AppVersion"/> reports exactly the csproj's &lt;Version&gt; with no
    /// "+&lt;git-sha&gt;" suffix — the exact bug this test exists to catch, since the SDK appends
    /// that suffix to AssemblyInformationalVersionAttribute automatically in a git checkout.
    /// </summary>
    [Fact]
    public void AppVersion_HasNoSourceRevisionSuffix()
    {
        Assert.DoesNotContain('+', AppVersion.Current);
        Assert.Equal(CsprojVersion(), AppVersion.Current);
    }

    private static string CsprojVersion([CallerFilePath] string testFilePath = "")
    {
        string repoRoot = Path.GetFullPath(
            Path.Combine(Path.GetDirectoryName(testFilePath)!, "..", ".."));
        XDocument doc = XDocument.Load(Path.Combine(repoRoot, "OpenRestoApi", "OpenRestoApi.csproj"));
        return doc.Root!.Elements("PropertyGroup").Elements("Version").Single().Value;
    }
}
