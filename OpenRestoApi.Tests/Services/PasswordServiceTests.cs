using OpenRestoApi.Core.Application.Services;

namespace OpenRestoApi.Tests.Services;

public class PasswordServiceTests
{
    // ── Hash ────────────────────────────────────────────────────────────────────

    [Fact]
    public void Hash_Returns_NonEmpty_Base64_Hash_And_Salt()
    {
        var svc = new PasswordService();

        (string hash, string salt) = svc.Hash("password123");

        Assert.False(string.IsNullOrWhiteSpace(hash));
        Assert.False(string.IsNullOrWhiteSpace(salt));
        // Base64 of 32-byte hash = 44 chars; Base64 of 16-byte salt = 24 chars.
        Assert.Equal(44, hash.Length);
        Assert.Equal(24, salt.Length);
    }

    [Fact]
    public void Hash_Generates_Different_Salt_Each_Call()
    {
        var svc = new PasswordService();

        (_, string salt1) = svc.Hash("same");
        (_, string salt2) = svc.Hash("same");

        Assert.NotEqual(salt1, salt2);
    }

    [Fact]
    public void Hash_Generates_Different_Hash_For_Same_Password_Different_Salt()
    {
        var svc = new PasswordService();

        string h1 = svc.Hash("same").Hash;
        string h2 = svc.Hash("same").Hash;

        Assert.NotEqual(h1, h2);
    }

    // ── Verify ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Verify_Accepts_Correct_Password()
    {
        var svc = new PasswordService();
        (string hash, string salt) = svc.Hash("correct horse battery staple");

        bool ok = svc.Verify("correct horse battery staple", hash, salt);

        Assert.True(ok);
    }

    [Fact]
    public void Verify_Rejects_Wrong_Password()
    {
        var svc = new PasswordService();
        (string hash, string salt) = svc.Hash("right");

        bool ok = svc.Verify("wrong", hash, salt);

        Assert.False(ok);
    }

    [Fact]
    public void Verify_Rejects_Case_Variants()
    {
        var svc = new PasswordService();
        (string hash, string salt) = svc.Hash("Secret");

        Assert.False(svc.Verify("secret", hash, salt));
        Assert.False(svc.Verify("SECRET", hash, salt));
    }

    [Fact]
    public void Verify_Rejects_Empty_Password_Against_Real_Hash()
    {
        var svc = new PasswordService();
        (string hash, string salt) = svc.Hash("nonempty");

        Assert.False(svc.Verify("", hash, salt));
    }

    [Fact]
    public void Verify_Throws_On_Malformed_Base64_Hash()
    {
        var svc = new PasswordService();
        // Documented behaviour: the canonical PBKDF2 verifier assumes well-formed Base64
        // inputs (it never receives otherwise in production — hashes are always written by
        // Hash()). A corrupted hash raises FormatException rather than returning false.
        (string _, string salt) = svc.Hash("x");

        Assert.Throws<FormatException>(() => svc.Verify("x", "bogus", salt));
    }

    // ── Round-trip ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("p")]
    [InlineData("password")]
    [InlineData("P@ssw0rd!")]
    [InlineData("Unicode密码🔐")]
    [InlineData("      ")] // whitespace-only is a valid input string
    public void Hash_Then_Verify_RoundTrips(string password)
    {
        var svc = new PasswordService();
        (string hash, string salt) = svc.Hash(password);

        Assert.True(svc.Verify(password, hash, salt));
    }
}
