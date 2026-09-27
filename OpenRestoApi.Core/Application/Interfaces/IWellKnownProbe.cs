namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// What one <c>/.well-known/</c> fetch came back as: the status and content type a store's
/// verifier would see, the body it would parse, or the reason nothing came back at all.
/// </summary>
public sealed record WellKnownProbeResult(int? StatusCode, string? ContentType, string? Body, string? Error)
{
    public static WellKnownProbeResult Unreachable(string error) => new(null, null, null, error);
}

/// <summary>
/// Fetches a document from the deployment's own public address. Behind an interface so the
/// readiness checks are unit-testable without a network, and so there is exactly one place that
/// decides what a probe is allowed to request.
/// </summary>
public interface IWellKnownProbe
{
    Task<WellKnownProbeResult> FetchAsync(Uri url, CancellationToken cancellationToken = default);
}
