namespace Api;

public record InitRequest(byte Count, byte Threshold);
public record InitResponse(string[] Shards, string Hash, string RootToken);

public record UnsealRequest(string[] Shards, byte Threshold, string Hash);
public record UnsealResponse(bool Success);

public record EncryptRequest(string Plaintext);
public record EncryptResponse(string Ciphertext);

public record DecryptRequest(string Ciphertext);
public record DecryptResponse(string Plaintext);

public record CreateTokenRequest(string Name);
public record CreateTokenResponse(string Token, string Name);

public record AdminTokenRequest(string[] Shards, byte Threshold, string Hash);
public record AdminTokenResponse(string Token);

public record TokenInfo(string Token, string Name, string Role, DateTime CreatedAt, DateTime? ExpiresAt);
public record TokenListResponse(TokenInfo[] Tokens);

public record CreateCredentialRequest(string Name, string Kind);
public record CreateCredentialResponse(string Id, string Secret, string Name, string Kind);

public record CredentialInfo(string Id, string Name, string Kind, DateTime CreatedAt);
public record CredentialListResponse(CredentialInfo[] Credentials);

public record AuthRequest(string Id, string Secret);
public record AuthResponse(string Token, DateTime ExpiresAt);

// KV
public record KvPutRequest(Dictionary<string, string> Secrets);
public record KvPutResponse(string Path, int Count);
public record KvGetResponse(string Path, Dictionary<string, string> Secrets);
public record KvListItem(string Name, string FullPath, string Type, int SecretCount, int ChildCount);
public record KvListResponse(string Path, KvListItem[] Items);

// Search
public record SearchResult(string Path, string Key, int Version, DateTime UpdatedAt);
public record SearchPathResult(string Path, int ChildCount, int SecretCount);
public record SearchResponse(List<SearchResult> Secrets, List<SearchPathResult> Paths);
