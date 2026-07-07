namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>
/// PBKDF2 password hashing/verification (100,000 iterations, SHA256, 32-byte hash,
/// 16-byte salt, Base64-encoded). Used for both login passwords and PVQ answer hashing.
/// </summary>
public interface IPasswordService
{
    /// <summary>Hashes a password, returning the Base64 hash and Base64 salt.</summary>
    (string Hash, string Salt) Hash(string password);

    /// <summary>Verifies a password against stored Base64 hash and salt in fixed time.</summary>
    bool Verify(string password, string storedHash, string storedSalt);
}
