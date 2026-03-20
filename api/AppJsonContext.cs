using System.Text.Json.Serialization;

namespace Api;

[JsonSerializable(typeof(VersionResponse))]
[JsonSerializable(typeof(VaultStatus))]
[JsonSerializable(typeof(InitRequest))]
[JsonSerializable(typeof(InitResponse))]
[JsonSerializable(typeof(UnsealRequest))]
[JsonSerializable(typeof(UnsealResponse))]
[JsonSerializable(typeof(EncryptRequest))]
[JsonSerializable(typeof(EncryptResponse))]
[JsonSerializable(typeof(DecryptRequest))]
[JsonSerializable(typeof(DecryptResponse))]
[JsonSerializable(typeof(CreateTokenRequest))]
[JsonSerializable(typeof(CreateTokenResponse))]
[JsonSerializable(typeof(AdminTokenRequest))]
[JsonSerializable(typeof(AdminTokenResponse))]
[JsonSerializable(typeof(TokenInfo))]
[JsonSerializable(typeof(TokenListResponse))]
[JsonSerializable(typeof(CreateCredentialRequest))]
[JsonSerializable(typeof(CreateCredentialResponse))]
[JsonSerializable(typeof(CredentialInfo))]
[JsonSerializable(typeof(CredentialListResponse))]
[JsonSerializable(typeof(AuthRequest))]
[JsonSerializable(typeof(AuthResponse))]
internal partial class AppJsonContext : JsonSerializerContext
{
}
