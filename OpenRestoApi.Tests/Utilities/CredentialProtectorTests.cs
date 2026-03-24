using Microsoft.AspNetCore.DataProtection;
using OpenRestoApi.Infrastructure.Email;

namespace OpenRestoApi.Tests.Utilities;

public class CredentialProtectorTests
{
    private static CredentialProtector CreateProtector()
    {
        IDataProtectionProvider provider = DataProtectionProvider.Create("TestApp");
        return new CredentialProtector(provider);
    }

    [Fact]
    public void EncryptThenDecrypt_ReturnsOriginal()
    {
        CredentialProtector protector = CreateProtector();
        string original = "my-secret-password-123!";

        string encrypted = protector.Encrypt(original);
        string decrypted = protector.Decrypt(encrypted);

        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void Encrypt_DifferentInputs_ProduceDifferentCiphertexts()
    {
        CredentialProtector protector = CreateProtector();

        string cipher1 = protector.Encrypt("password-one");
        string cipher2 = protector.Encrypt("password-two");

        Assert.NotEqual(cipher1, cipher2);
    }

    [Fact]
    public void Encrypt_ProducesNonEmptyOutput()
    {
        CredentialProtector protector = CreateProtector();

        string encrypted = protector.Encrypt("test");

        Assert.False(string.IsNullOrEmpty(encrypted));
    }

    [Fact]
    public void Encrypt_OutputDiffersFromInput()
    {
        CredentialProtector protector = CreateProtector();
        string input = "my-password";

        string encrypted = protector.Encrypt(input);

        Assert.NotEqual(input, encrypted);
    }

    [Fact]
    public void Decrypt_WithWrongCiphertext_Throws()
    {
        CredentialProtector protector = CreateProtector();

        // Decrypting garbage should throw a CryptographicException
        Assert.ThrowsAny<Exception>(() => protector.Decrypt("not-valid-ciphertext"));
    }

    [Fact]
    public void Decrypt_WithDifferentProtectorInstance_Succeeds()
    {
        // Both protectors use the same application name, so they share keys
        CredentialProtector protector1 = CreateProtector();
        CredentialProtector protector2 = CreateProtector();

        string encrypted = protector1.Encrypt("shared-secret");
        string decrypted = protector2.Decrypt(encrypted);

        Assert.Equal("shared-secret", decrypted);
    }
}
