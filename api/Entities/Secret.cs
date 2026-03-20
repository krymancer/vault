namespace Api.Entities;

public class Secret
{
    public Guid Id { get; set; }
    public Guid PathId { get; set; }
    public required string Key { get; set; }
    public required byte[] Value { get; set; }
    public int Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public SecretPath Path { get; set; } = null!;
}
