using System.Security.Cryptography;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Core.Application.Services;

/// <inheritdoc cref="IPasswordService" />
public sealed class PasswordService : IPasswordService
{
    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    private const int Iterations = 100_000;
    private static readonly HashAlgorithmName _algorithm = HashAlgorithmName.SHA256;

    public (string Hash, string Salt) Hash(string password)
    {
        byte[] saltBytes = RandomNumberGenerator.GetBytes(SaltBytes);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, Iterations, _algorithm, HashBytes);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(saltBytes));
    }

    public bool Verify(string password, string storedHash, string storedSalt)
    {
        byte[] saltBytes = Convert.FromBase64String(storedSalt);
        byte[] computed = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, Iterations, _algorithm, HashBytes);
        return CryptographicOperations.FixedTimeEquals(computed, Convert.FromBase64String(storedHash));
    }
}
