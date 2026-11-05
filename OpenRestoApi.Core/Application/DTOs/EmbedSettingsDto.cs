namespace OpenRestoApi.Core.Application.DTOs;

public class EmbedSettingsDto
{
    public List<string> AllowedOrigins { get; set; } = [];
}

public class UpdateEmbedSettingsRequest
{
    public List<string> AllowedOrigins { get; set; } = [];
}
