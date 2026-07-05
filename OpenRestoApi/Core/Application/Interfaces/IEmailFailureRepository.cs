using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Persistence of <see cref="EmailFailure"/> rows (logged when booking confirmation emails fail to send).</summary>
public interface IEmailFailureRepository
{
    /// <summary>Adds and saves a failure record.</summary>
    Task AddAsync(EmailFailure failure);

    /// <summary>The most recent 50 failures, newest first.</summary>
    Task<List<EmailFailure>> GetRecentAsync(int count = 50);
}
