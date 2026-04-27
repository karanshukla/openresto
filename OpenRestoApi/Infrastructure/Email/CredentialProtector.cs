using Microsoft.AspNetCore.DataProtection;

namespace OpenRestoApi.Infrastructure.Email;

public class CredentialProtector(IDataProtectionProvider provider)
{
    private const string _purpose = "EmailSettings.Password";
    private readonly IDataProtector _protector = provider.CreateProtector(_purpose);

    public virtual string Encrypt(string plainText) => _protector.Protect(plainText);

    public virtual string Decrypt(string cipherText) => _protector.Unprotect(cipherText);
}
