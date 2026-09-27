namespace OpenRestoApi.Core.Application.Interfaces;

/// <summary>Encrypts a stored secret (the SMTP password) at rest, and back.</summary>
public interface ICredentialProtector
{
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}
