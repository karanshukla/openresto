using Microsoft.AspNetCore.DataProtection;
using OpenRestoApi.Infrastructure.Email;

namespace OpenRestoApi.Tests.Utilities;

public class CredentialProtectorTests
{
    private static CredentialProtector CreateProtector()
    {
        var provider = DataProtectionProvider.Create("TestApp");
        return new CredentialProtector(provider);
    }

    [Fact]
    public void EncryptThenDecrypt_ReturnsOriginal()
    {
        var protector = CreateProtector();
        var original = "my-secret-password-123!";

        var encrypted = protector.Encrypt(original);
        var decrypted = protector.Decrypt(encrypted);

        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void Encrypt_DifferentInputs_ProduceDifferentCiphertexts()
    {
        var protector = CreateProtector();

        var cipher1 = protector.Encrypt("password-one");
        var cipher2 = protector.Encrypt("password-two");

        Assert.NotEqual(cipher1, cipher2);
    }

    [Fact]
    public void Encrypt_ProducesNonEmptyOutput()
    {
        var protector = CreateProtector();

        var encrypted = protector.Encrypt("test");

        Assert.False(string.IsNullOrEmpty(encrypted));
    }

    [Fact]
    public void Encrypt_OutputDiffersFromInput()
    {
        var protector = CreateProtector();
        var input = "my-password";

        var encrypted = protector.Encrypt(input);

        Assert.NotEqual(input, encrypted);
    }

    [Fact]
    public void Decrypt_WithWrongCiphertext_Throws()
    {
        var protector = CreateProtector();

        // Decrypting garbage should throw a CryptographicException
        Assert.ThrowsAny<Exception>(() => protector.Decrypt("not-valid-ciphertext"));
    }

    [Fact]
    public void Decrypt_WithDifferentProtectorInstance_Succeeds()
    {
        // Both protectors use the same application name, so they share keys
        var protector1 = CreateProtector();
        var protector2 = CreateProtector();

        var encrypted = protector1.Encrypt("shared-secret");
        var decrypted = protector2.Decrypt(encrypted);

        Assert.Equal("shared-secret", decrypted);
    }
}
