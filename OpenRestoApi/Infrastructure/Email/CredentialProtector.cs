using Microsoft.AspNetCore.DataProtection;

namespace OpenRestoApi.Infrastructure.Email;

public class CredentialProtector(IDataProtectionProvider provider)
{
    private const string Purpose = "EmailSettings.Password";
    private readonly IDataProtector _protector = provider.CreateProtector(Purpose);

    public virtual string Encrypt(string plainText) => _protector.Protect(plainText);

    public virtual string Decrypt(string cipherText) => _protector.Unprotect(cipherText);
}
