using System.Text.Json.Serialization;

namespace Api;

[JsonSerializable(typeof(VersionResponse))]
[JsonSerializable(typeof(VaultStatus))]
internal partial class AppJsonContext : JsonSerializerContext
{
}