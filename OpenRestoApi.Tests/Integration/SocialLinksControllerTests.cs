using System.Net;
using System.Net.Http.Json;
using OpenRestoApi.Core.Application.DTOs;

namespace OpenRestoApi.Tests.Integration;

public class SocialLinksControllerTests(TestWebAppFactory factory) : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory = factory;

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/api/social-links");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/social-links", new
        {
            label = "Instagram",
            url = "https://instagram.com/resto",
            iconKey = "logo-instagram",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithAuth_Returns201WithDto()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/social-links", new
        {
            label = "Integration Test Link",
            url = "https://example.com/resto",
            iconKey = "link-outline",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        SocialLinkDto? dto = await response.Content.ReadFromJsonAsync<SocialLinkDto>();
        Assert.NotNull(dto);
        Assert.NotEqual(0, dto.Id);
        Assert.Equal("Integration Test Link", dto.Label);
    }

    [Fact]
    public async Task Update_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/social-links/1", new
        {
            label = "X",
            url = "https://x.example.com",
            iconKey = "link-outline",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Update_ExistingSocialLink_Returns200()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/social-links", new
        {
            label = "Original",
            url = "https://original.example.com",
            iconKey = "link-outline",
            sortOrder = 0
        });
        SocialLinkDto? created = await createResp.Content.ReadFromJsonAsync<SocialLinkDto>();
        Assert.NotNull(created);

        HttpResponseMessage updateResp = await client.PutAsJsonAsync($"/api/social-links/{created.Id}", new
        {
            label = "Updated",
            url = "https://updated.example.com",
            iconKey = "logo-facebook",
            sortOrder = 1
        });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        SocialLinkDto? updated = await updateResp.Content.ReadFromJsonAsync<SocialLinkDto>();
        Assert.Equal("Updated", updated?.Label);
        Assert.Equal("logo-facebook", updated?.IconKey);
    }

    [Fact]
    public async Task Update_NonExistingSocialLink_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.PutAsJsonAsync("/api/social-links/99999", new
        {
            label = "X",
            url = "https://x.example.com",
            iconKey = "link-outline",
            sortOrder = 0
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_WithoutAuth_Returns401()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/social-links/1");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Delete_ExistingSocialLink_Returns204()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage createResp = await client.PostAsJsonAsync("/api/social-links", new
        {
            label = "ToDelete",
            url = "https://delete.example.com",
            iconKey = "link-outline",
            sortOrder = 0
        });
        SocialLinkDto? created = await createResp.Content.ReadFromJsonAsync<SocialLinkDto>();
        Assert.NotNull(created);

        HttpResponseMessage deleteResp = await client.DeleteAsync($"/api/social-links/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);
    }

    [Fact]
    public async Task Delete_NonExistingSocialLink_Returns404()
    {
        HttpClient client = _factory.CreateAuthenticatedClient();
        HttpResponseMessage response = await client.DeleteAsync("/api/social-links/99999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
