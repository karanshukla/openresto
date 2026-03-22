using Microsoft.AspNetCore.DataProtection;

namespace OpenRestoApi.Infrastructure.Email;

public class CredentialProtector
{
    private const string Purpose = "EmailSettings.Password";
    private readonly IDataProtector _protector;

    public CredentialProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector(Purpose);
    }

    public string Encrypt(string plainText) => _protector.Protect(plainText);

    public string Decrypt(string cipherText) => _protector.Unprotect(cipherText);
}
