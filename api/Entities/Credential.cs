namespace Api.Entities;

public class Credential
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Kind { get; set; }
    public required string SecretHmac { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
