namespace Api.Entities;

public class VaultState
{
    public int Id { get; set; } = 1;
    public required string KeyHash { get; set; }
    public int ShardCount { get; set; }
    public int Threshold { get; set; }
    public DateTime InitializedAt { get; set; } = DateTime.UtcNow;
}
