using OpenRestoApi.Core.Application.Services;
using OpenRestoApi.Core.Domain;

namespace OpenRestoApi.Tests.Services;

public class CredentialHelperTests
{
    // Uses the real PasswordService (no mock) — matches the AuthServiceTests precedent.
    private static readonly PasswordService _passwords = new();

    private static AdminCredential NewCredential(string password)
    {
        (string hash, string salt) = _passwords.Hash(password);
        return new AdminCredential
        {
            Email = "admin@example.com",
            PasswordHash = hash,
            PasswordSalt = salt
        };
    }

    [Fact]
    public void VerifyPassword_True_WhenPasswordMatches()
    {
        AdminCredential cred = NewCredential("correct-horse-battery");
        Assert.True(CredentialHelper.VerifyPassword(cred, "correct-horse-battery", _passwords));
    }

    [Fact]
    public void VerifyPassword_False_WhenPasswordDoesNotMatch()
    {
        AdminCredential cred = NewCredential("correct-horse-battery");
        Assert.False(CredentialHelper.VerifyPassword(cred, "wrong", _passwords));
    }

    [Fact]
    public void VerifyPassword_False_ForEmptyPassword()
    {
        AdminCredential cred = NewCredential("real-password");
        Assert.False(CredentialHelper.VerifyPassword(cred, "", _passwords));
    }

    [Fact]
    public void VerifyPassword_IsCaseAndPunctuationSensitive()
    {
        AdminCredential cred = NewCredential("Secret123!");
        Assert.False(CredentialHelper.VerifyPassword(cred, "secret123!", _passwords));
        Assert.True(CredentialHelper.VerifyPassword(cred, "Secret123!", _passwords));
    }
}
