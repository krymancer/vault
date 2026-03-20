using Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Api;

public class VaultDbContext(DbContextOptions<VaultDbContext> options) : DbContext(options)
{
    public DbSet<VaultState> VaultState => Set<VaultState>();
    public DbSet<SecretPath> Paths => Set<SecretPath>();
    public DbSet<Secret> Secrets => Set<Secret>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<Token> Tokens => Set<Token>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.Entity<VaultState>(e =>
        {
            e.ToTable("vault_state");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<SecretPath>(e =>
        {
            e.ToTable("paths");
            e.HasKey(x => x.Id);
            e.HasAlternateKey(x => x.FullPath);
            e.HasIndex(x => x.FullPath).HasDatabaseName("IX_paths_FullPath_trgm")
                .HasMethod("gin").HasOperators("gin_trgm_ops");
            e.HasOne(x => x.Parent)
                .WithMany(x => x.Children)
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Secret>(e =>
        {
            e.ToTable("secrets");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.PathId, x.Key }).IsUnique();
            e.HasIndex(x => x.Key).HasMethod("gin")
                .HasOperators("gin_trgm_ops");
            e.HasOne(x => x.Path)
                .WithMany(x => x.Secrets)
                .HasForeignKey(x => x.PathId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Credential>(e =>
        {
            e.ToTable("credentials");
            e.HasKey(x => x.Id);
        });

        modelBuilder.Entity<Token>(e =>
        {
            e.ToTable("tokens");
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Credential)
                .WithMany()
                .HasForeignKey(x => x.CredentialId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
