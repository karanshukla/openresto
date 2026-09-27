using Microsoft.AspNetCore.DataProtection;
using OpenRestoApi.Core.Application.Interfaces;

namespace OpenRestoApi.Infrastructure.Email;

public class CredentialProtector(IDataProtectionProvider provider) : ICredentialProtector
{
    private const string _purpose = "EmailSettings.Password";
    private readonly IDataProtector _protector = provider.CreateProtector(_purpose);

    public string Encrypt(string plainText) => _protector.Protect(plainText);

    public string Decrypt(string cipherText) => _protector.Unprotect(cipherText);
}
