using OpenRestoApi.Core.Application.Utilities;

namespace OpenRestoApi.Tests.Utilities;

public class ApiKeyCryptoTests
{
    [Fact]
    public void GenerateRawKey_ProducesAParsableKeyThatVerifiesAgainstItsOwnHash()
    {
        string rawKey = ApiKeyCrypto.GenerateRawKey(42);

        Assert.StartsWith(ApiKeyCrypto.KeyPrefix, rawKey, StringComparison.Ordinal);
        Assert.True(ApiKeyCrypto.TryParseId(rawKey, out int id));
        Assert.Equal(42, id);
        Assert.True(ApiKeyCrypto.Verify(rawKey, ApiKeyCrypto.Hash(rawKey)));
    }

    [Fact]
    public void GenerateRawKey_ProducesDistinctSecretsOnEachCall()
    {
        string first = ApiKeyCrypto.GenerateRawKey(1);
        string second = ApiKeyCrypto.GenerateRawKey(1);

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void Verify_AcceptsTheExactKeyThatProducedTheHash()
    {
        string rawKey = ApiKeyCrypto.GenerateRawKey(7);
        string hash = ApiKeyCrypto.Hash(rawKey);

        Assert.True(ApiKeyCrypto.Verify(rawKey, hash));
    }

    [Fact]
    public void Verify_RejectsAKeyWithATamperedSecret()
    {
        string rawKey = ApiKeyCrypto.GenerateRawKey(7);
        string hash = ApiKeyCrypto.Hash(rawKey);
        string tampered = rawKey[..^1] + (rawKey[^1] == 'A' ? 'B' : 'A');

        Assert.False(ApiKeyCrypto.Verify(tampered, hash));
    }

    [Fact]
    public void Verify_RejectsAKeyMintedForADifferentId()
    {
        string hashForId1 = ApiKeyCrypto.Hash(ApiKeyCrypto.GenerateRawKey(1));
        string rawKeyForId2 = ApiKeyCrypto.GenerateRawKey(2);

        Assert.False(ApiKeyCrypto.Verify(rawKeyForId2, hashForId1));
    }

    [Fact]
    public void TryParseId_ExtractsTheIdFromAWellFormedKey()
    {
        Assert.True(ApiKeyCrypto.TryParseId("orst_123_abcXYZ-_9", out int id));
        Assert.Equal(123, id);
    }

    [Theory]
    [InlineData("wrong_123_secret")]
    [InlineData("Orst_123_secret")]
    [InlineData("")]
    public void TryParseId_RejectsAKeyWithTheWrongPrefix(string rawKey)
        => Assert.False(ApiKeyCrypto.TryParseId(rawKey, out _));

    [Fact]
    public void TryParseId_RejectsAKeyWithANonNumericId()
        => Assert.False(ApiKeyCrypto.TryParseId("orst_abc_secret", out _));

    [Fact]
    public void TryParseId_RejectsAKeyWithANonPositiveId()
    {
        Assert.False(ApiKeyCrypto.TryParseId("orst_0_secret", out _));
        Assert.False(ApiKeyCrypto.TryParseId("orst_-1_secret", out _));
    }

    [Theory]
    [InlineData("orst_123_")]
    [InlineData("orst_123")]
    [InlineData("orst_")]
    public void TryParseId_RejectsAKeyWithNoSecretSegment(string rawKey)
        => Assert.False(ApiKeyCrypto.TryParseId(rawKey, out _));

    [Fact]
    public void TryParseId_RejectsNull()
        => Assert.False(ApiKeyCrypto.TryParseId(null, out _));

    [Fact]
    public void DisplayPrefix_TruncatesToAFixedNonSecretLength()
    {
        string rawKey = ApiKeyCrypto.GenerateRawKey(5);
        string prefix = ApiKeyCrypto.DisplayPrefix(rawKey);

        Assert.True(prefix.Length <= 16);
        Assert.StartsWith(prefix, rawKey, StringComparison.Ordinal);
        Assert.NotEqual(rawKey, prefix);
    }
}
