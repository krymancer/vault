namespace Api.Entities;

public class SecretPath
{
    public Guid Id { get; set; }
    public Guid? ParentId { get; set; }
    public required string Name { get; set; }
    public required string FullPath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SecretPath? Parent { get; set; }
    public List<SecretPath> Children { get; set; } = [];
    public List<Secret> Secrets { get; set; } = [];
}
