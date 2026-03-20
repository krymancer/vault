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

public record TokenInfo(string Token, string Name, string Role, DateTime CreatedAt);
public record TokenListResponse(TokenInfo[] Tokens);
