using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Api;

internal static class CredentialStore
{
    private static readonly ConcurrentDictionary<string, CredentialEntry> _credentials = new();

    public record CredentialEntry(string Name, string Kind, string SecretHmac, DateTime CreatedAt);

    public static (string id, string secret) Create(string name, string kind)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        var secretBytes = Encoding.UTF8.GetBytes(secret);
        var hmacOutput = new byte[32];

        unsafe
        {
            fixed (byte* pInput = secretBytes)
            fixed (byte* pOutput = hmacOutput)
            {
                var res = VaultLibrary.Hmac(pInput, (nuint)secretBytes.Length, pOutput);
                if (res != 0) throw new InvalidOperationException("Vault is sealed");
            }
        }

        _credentials[id] = new CredentialEntry(name, kind, Convert.ToHexString(hmacOutput), DateTime.UtcNow);
        return (id, secret);
    }

    public static bool Verify(string id, string secret)
    {
        if (!_credentials.TryGetValue(id, out var entry)) return false;

        var secretBytes = Encoding.UTF8.GetBytes(secret);
        var expectedHmac = Convert.FromHexString(entry.SecretHmac);

        unsafe
        {
            fixed (byte* pInput = secretBytes)
            fixed (byte* pExpected = expectedHmac)
            {
                return VaultLibrary.HmacVerify(pInput, (nuint)secretBytes.Length, pExpected) == 0;
            }
        }
    }

    public static CredentialEntry? Get(string id) =>
        _credentials.TryGetValue(id, out var entry) ? entry : null;

    public static bool Delete(string id) => _credentials.TryRemove(id, out _);

    public static IEnumerable<(string Id, CredentialEntry Entry)> All() =>
        _credentials.Select(kv => (kv.Key, kv.Value));

    public static void Clear() => _credentials.Clear();
}
