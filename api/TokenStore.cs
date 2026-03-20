using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Api;

internal static class TokenStore
{
    private static readonly ConcurrentDictionary<string, TokenEntry> _tokens = new();

    public record TokenEntry(string Name, string Role, DateTime CreatedAt);

    public static string CreateToken(string name, string role)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        _tokens[token] = new TokenEntry(name, role, DateTime.UtcNow);
        return token;
    }

    public static bool Revoke(string token) => _tokens.TryRemove(token, out _);

    public static TokenEntry? Validate(string token) =>
        _tokens.TryGetValue(token, out var entry) ? entry : null;

    public static bool IsAdmin(string token) =>
        Validate(token) is { Role: "admin" };

    public static IEnumerable<(string Token, TokenEntry Entry)> All() =>
        _tokens.Select(kv => (kv.Key, kv.Value));

    public static void Clear() => _tokens.Clear();
}
