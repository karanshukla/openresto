using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Tests.Integration;

public class HighlightsControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/api/highlights");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Test",
            body = "Body",
            iconKey = "star",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithAuth_Returns201WithDto()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Integration Test Highlight",
            body = "Some body text",
            iconKey = "star",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        HighlightDto? dto = await response.Content.ReadFromJsonAsync<HighlightDto>();
        Assert.NotNull(dto);
        Assert.NotEqual(0, dto.Id);
        Assert.Equal("Integration Test Highlight", dto.Title);
    }

    [Fact]
    public async Task Update_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/highlights/1", new
        {
            title = "X",
            body = "y",
            iconKey = "star",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Update_ExistingHighlight_Returns200()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        // Create first
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Original",
            body = "body",
            iconKey = "star",
            sortOrder = 0
        });
        HighlightDto? created = await createResp.Content.ReadFromJsonAsync<HighlightDto>();
        Assert.NotNull(created);

        HttpResponseMessage updateResp = await client.PutAsJsonAsync($"/api/highlights/{created.Id}", new
        {
            title = "Updated",
            body = "updated body",
            iconKey = "flame",
            sortOrder = 1
        });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        HighlightDto? updated = await updateResp.Content.ReadFromJsonAsync<HighlightDto>();
        Assert.Equal("Updated", updated?.Title);
        Assert.Equal("flame", updated?.IconKey);
    }

    [Fact]
    public async Task Update_NonExistingHighlight_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/highlights/99999", new
        {
            title = "X",
            body = "y",
            iconKey = "star",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/highlights/1");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Delete_ExistingHighlight_Returns204()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        // Create first
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "ToDelete",
            body = "body",
            iconKey = "star",
            sortOrder = 0
        });
        HighlightDto? created = await createResp.Content.ReadFromJsonAsync<HighlightDto>();
        Assert.NotNull(created);

        HttpResponseMessage deleteResp = await client.DeleteAsync($"/api/highlights/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistingHighlight_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/highlights/99999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── Validation (Create) ─────────────────────────────────────────────────

    [Fact]
    public async Task Create_EmptyTitle_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "   ",
            body = "Body",
            iconKey = "star-outline",
            sortOrder = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("title cannot be empty", body.GetProperty("message").GetString()!);
    }

    [Fact]
    public async Task Create_OversizedTitle_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = new string('A', 61),
            body = "Body",
            iconKey = "star-outline",
            sortOrder = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_OversizedBody_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Ok",
            body = new string('B', 501),
            iconKey = "star-outline",
            sortOrder = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("asdf")]
    public async Task Create_InvalidLink_Returns400(string link)
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Ok",
            body = "Body",
            iconKey = "star-outline",
            sortOrder = 0,
            link = link,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("valid absolute URL", body.GetProperty("message").GetString()!);
    }

    [Fact]
    public async Task Create_UnknownIconKey_Returns400()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Ok",
            body = "Body",
            iconKey = "not-a-real-icon",
            sortOrder = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        JsonElement body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("Icon key", body.GetProperty("message").GetString()!);
    }

    [Fact]
    public async Task Create_ValidHighlightWithLink_Returns201()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/highlights", new
        {
            title = "Award Winner",
            body = "We won!",
            iconKey = "trophy-outline",
            sortOrder = 0,
            link = "https://example.com/awards",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        HighlightDto? dto = await response.Content.ReadFromJsonAsync<HighlightDto>();
        Assert.NotNull(dto);
        Assert.Equal("https://example.com/awards", dto.Link);
    }
}
