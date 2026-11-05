using OpenRestoApi.Core.Application.DTOs;
using OpenRestoApi.Core.Application.Exceptions;
using OpenRestoApi.Core.Application.Interfaces;
using OpenRestoApi.Core.Application.Utilities;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Services;

/// <summary>Which sites may frame the booking widget (issue #513).</summary>
public class EmbedSettingsService(IBrandSettingsRepository brandRepository, IAuditScope? audit = null)
{
    private readonly IBrandSettingsRepository _brandRepository = brandRepository;
    private readonly IAuditScope _audit = audit ?? NullAuditScope.Instance;

    public async Task<EmbedSettingsDto> GetAsync()
    {
        BrandSettings? brand = await _brandRepository.GetAsync();
        return new EmbedSettingsDto { AllowedOrigins = [.. EmbedOrigins.Split(brand?.EmbedOrigins)] };
    }

    /// <summary>The <c>frame-ancestors</c> source list nginx sends with the widget page.</summary>
    public async Task<string> GetFrameAncestorsAsync()
    {
        BrandSettings? brand = await _brandRepository.GetAsync();
        return EmbedOrigins.FrameAncestors(brand?.EmbedOrigins);
    }

    /// <summary>Replaces the allowed list, canonicalising and de-duplicating each origin.</summary>
    /// <seealso>EmbedSettingsServiceTests.Update_StoresCanonicalOriginsOnce</seealso>
    /// <seealso>EmbedSettingsServiceTests.Update_RejectsSomethingThatIsNotAnOrigin</seealso>
    /// <seealso>EmbedSettingsServiceTests.Update_RejectsMoreThanTheCap</seealso>
    public async Task<EmbedSettingsDto> UpdateAsync(UpdateEmbedSettingsRequest request)
    {
        List<string> origins = [.. request.AllowedOrigins.Select(Normalize).Distinct()];
        if (origins.Count > EmbedOrigins.MaxCount)
        {
            throw new ValidationException($"At most {EmbedOrigins.MaxCount} sites can embed the booking widget.")
            {
                Code = ErrorCodes.EmbedTooManyOrigins,
                Args = new Dictionary<string, object> { ["max"] = EmbedOrigins.MaxCount },
            };
        }

        BrandSettings? brand = await _brandRepository.GetAsync();
        bool isNew = brand == null;
        brand ??= new BrandSettings();

        string? before = brand.EmbedOrigins;
        brand.EmbedOrigins = EmbedOrigins.Join(origins);

        if (isNew)
        {
            await _brandRepository.AddAsync(brand);
        }
        else
        {
            await _brandRepository.SaveChangesAsync();
        }

        _audit.RecordChange("embedOrigins", before, brand.EmbedOrigins);
        _audit.Describe(AuditActions.EmbedSettingsUpdate, AuditTargets.Brand, AuditTargets.IdOf(brand.Id),
            brand.AppName, summary: "Updated the sites allowed to embed the booking widget");

        return new EmbedSettingsDto { AllowedOrigins = origins };
    }

    private static string Normalize(string value)
    {
        if (EmbedOrigins.TryNormalize(value, out string origin))
        {
            return origin;
        }

        throw new ValidationException($"\"{value}\" is not a site address. Use the form https://example.com.")
        {
            Code = ErrorCodes.EmbedOriginInvalid,
            Args = new Dictionary<string, object> { ["origin"] = value },
        };
    }
}
