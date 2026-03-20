namespace Api.Entities;

public class Token
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Role { get; set; }
    public string? CredentialId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }

    public Credential? Credential { get; set; }
}
