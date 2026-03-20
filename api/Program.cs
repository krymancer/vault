using System.Security.Cryptography;
using System.Text;
using Api;
using Api.Entities;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default);
});

builder.Services.AddDbContext<VaultDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<VaultDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

var tokenTtl = TimeSpan.FromHours(1);

static string? GetBearerToken(HttpContext ctx)
{
    var header = ctx.Request.Headers.Authorization.ToString();
    if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        return header["Bearer ".Length..];
    return null;
}

async Task<Token?> ValidateToken(VaultDbContext db, string? token)
{
    if (token is null) return null;
    var t = await db.Tokens.FindAsync(token);
    if (t is null) return null;
    if (t.ExpiresAt.HasValue && t.ExpiresAt.Value < DateTime.UtcNow)
    {
        db.Tokens.Remove(t);
        await db.SaveChangesAsync();
        return null;
    }
    return t;
}

async Task<bool> IsAdmin(VaultDbContext db, string? token)
{
    var t = await ValidateToken(db, token);
    return t is { Role: "admin" };
}

// --- Status ---

app.MapGet("/version", static () =>
{
    var v = VaultLibrary.IsOpen() ? VaultStatus.Operational : VaultStatus.Closed;
    return Results.Ok(new VersionResponse(v));
});

// --- Init / Unseal ---

app.MapPost("/init", async (InitRequest request, VaultDbContext db) =>
{
    if (request.Count < request.Threshold || request.Threshold < 2)
        return Results.BadRequest("Invalid count or threshold");

    var shardsBuffer = new byte[request.Count * 33];
    var hashBuffer = new byte[32];

    int res;
    unsafe
    {
        fixed (byte* pShards = shardsBuffer)
        fixed (byte* pHash = hashBuffer)
        {
            res = VaultLibrary.Init(request.Count, request.Threshold, pShards, pHash);
        }
    }

    if (res != 0) return Results.StatusCode(500);

    var shards = new string[request.Count];
    for (int i = 0; i < request.Count; i++)
        shards[i] = Convert.ToHexString(shardsBuffer.AsSpan(i * 33, 33));

    var hash = Convert.ToHexString(hashBuffer);

    // Clear all data on re-init (order matters for FK constraints)
    await db.Tokens.ExecuteDeleteAsync();
    await db.Credentials.ExecuteDeleteAsync();
    await db.Secrets.ExecuteDeleteAsync();
    await db.Paths.ExecuteDeleteAsync();
    await db.VaultState.ExecuteDeleteAsync();

    db.VaultState.Add(new VaultState
    {
        KeyHash = hash,
        ShardCount = request.Count,
        Threshold = request.Threshold
    });

    var rootTokenValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    db.Tokens.Add(new Token { Id = rootTokenValue, Name = "root", Role = "admin" });

    await db.SaveChangesAsync();
    return Results.Ok(new InitResponse(shards, hash, rootTokenValue));
});

app.MapPost("/unseal", (UnsealRequest request) =>
{
    if (request.Shards.Length < request.Threshold)
        return Results.BadRequest("Not enough shards");

    var shardsBuffer = new byte[request.Threshold * 33];
    for (int i = 0; i < request.Threshold; i++)
    {
        var shardBytes = Convert.FromHexString(request.Shards[i]);
        if (shardBytes.Length != 33)
            return Results.BadRequest($"Invalid shard length for shard {i}");
        shardBytes.CopyTo(shardsBuffer.AsSpan(i * 33));
    }

    var hashBuffer = Convert.FromHexString(request.Hash);
    if (hashBuffer.Length != 32) return Results.BadRequest("Invalid hash length");

    int res;
    unsafe
    {
        fixed (byte* pShards = shardsBuffer)
        fixed (byte* pHash = hashBuffer)
        {
            res = VaultLibrary.Unseal(pShards, request.Threshold, pHash);
        }
    }

    return Results.Ok(new UnsealResponse(res == 0));
});

// --- Auth ---

app.MapPost("/auth", async (AuthRequest request, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);

    var cred = await db.Credentials.FindAsync(request.Id);
    if (cred is null) return Results.Unauthorized();

    var secretBytes = Encoding.UTF8.GetBytes(request.Secret);
    var expectedHmac = Convert.FromHexString(cred.SecretHmac);
    bool valid;
    unsafe
    {
        fixed (byte* pInput = secretBytes)
        fixed (byte* pExpected = expectedHmac)
        {
            valid = VaultLibrary.HmacVerify(pInput, (nuint)secretBytes.Length, pExpected) == 0;
        }
    }

    if (!valid) return Results.Unauthorized();

    var role = cred.Kind == "user" ? "user" : "app";
    var tokenValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    var expiresAt = DateTime.UtcNow + tokenTtl;

    db.Tokens.Add(new Token
    {
        Id = tokenValue, Name = cred.Name, Role = role,
        CredentialId = cred.Id, ExpiresAt = expiresAt
    });
    await db.SaveChangesAsync();

    return Results.Ok(new AuthResponse(tokenValue, expiresAt));
});

// --- Encrypt / Decrypt ---

app.MapPost("/encrypt", async (EncryptRequest request, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var plaintext = Encoding.UTF8.GetBytes(request.Plaintext);
    var output = new byte[12 + plaintext.Length + 16];

    int res;
    unsafe
    {
        fixed (byte* pPlaintext = plaintext)
        fixed (byte* pOutput = output)
        {
            res = VaultLibrary.Encrypt(pPlaintext, (nuint)plaintext.Length, pOutput);
        }
    }

    return res != 0 ? Results.StatusCode(500) : Results.Ok(new EncryptResponse(Convert.ToHexString(output)));
});

app.MapPost("/decrypt", async (DecryptRequest request, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var ciphertext = Convert.FromHexString(request.Ciphertext);
    if (ciphertext.Length < 12 + 16) return Results.BadRequest("Invalid ciphertext length");

    var output = new byte[ciphertext.Length - 12 - 16];

    int res;
    unsafe
    {
        fixed (byte* pCiphertext = ciphertext)
        fixed (byte* pOutput = output)
        {
            res = VaultLibrary.Decrypt(pCiphertext, (nuint)ciphertext.Length, pOutput);
        }
    }

    if (res == -3) return Results.BadRequest("Authentication failed: ciphertext is invalid or tampered");
    if (res != 0) return Results.StatusCode(500);

    return Results.Ok(new DecryptResponse(Encoding.UTF8.GetString(output)));
});

// --- KV Secrets ---

app.MapGet("/kv", async (HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var rootPaths = await db.Paths
        .Where(p => p.ParentId == null)
        .Include(p => p.Children)
        .Include(p => p.Secrets)
        .OrderBy(p => p.Name)
        .ToListAsync();

    var items = rootPaths.Select(p => new KvListItem(
        p.Name, p.FullPath, p.Children.Count > 0 ? "directory" : "secret",
        p.Secrets.Count, p.Children.Count
    )).ToArray();

    return Results.Ok(new KvListResponse("/", items));
});

app.MapGet("/kv/{**path}", async (string path, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var fullPath = "/" + path.TrimEnd('/');
    var secretPath = await db.Paths
        .Include(p => p.Secrets)
        .Include(p => p.Children)
        .FirstOrDefaultAsync(p => p.FullPath == fullPath);

    if (secretPath is null) return Results.NotFound();

    // If this path has children, return as a directory listing
    if (secretPath.Children.Count > 0)
    {
        // Load children's children and secrets counts
        var childPaths = await db.Paths
            .Where(p => p.ParentId == secretPath.Id)
            .Include(p => p.Children)
            .Include(p => p.Secrets)
            .OrderBy(p => p.Name)
            .ToListAsync();

        var items = childPaths.Select(p => new KvListItem(
            p.Name, p.FullPath, p.Children.Count > 0 ? "directory" : "secret",
            p.Secrets.Count, p.Children.Count
        )).ToArray();

        return Results.Ok(new KvListResponse(fullPath, items));
    }

    // Leaf path — return decrypted secrets
    var secrets = new Dictionary<string, string>();
    foreach (var s in secretPath.Secrets)
    {
        var ciphertext = s.Value;
        var output = new byte[ciphertext.Length - 12 - 16];

        int res;
        unsafe
        {
            fixed (byte* pCiphertext = ciphertext)
            fixed (byte* pOutput = output)
            {
                res = VaultLibrary.Decrypt(pCiphertext, (nuint)ciphertext.Length, pOutput);
            }
        }

        secrets[s.Key] = res == 0 ? Encoding.UTF8.GetString(output) : "[decryption error]";
    }

    return Results.Ok(new KvGetResponse(fullPath, secrets));
});

app.MapPut("/kv/{**path}", async (string path, KvPutRequest request, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var fullPath = "/" + path.TrimEnd('/');

    // Ensure all path segments exist
    var segments = fullPath.Split('/', StringSplitOptions.RemoveEmptyEntries);
    Guid? parentId = null;
    SecretPath? current = null;

    for (int i = 0; i < segments.Length; i++)
    {
        var segPath = "/" + string.Join("/", segments.Take(i + 1));
        current = await db.Paths
            .Include(p => p.Secrets)
            .Include(p => p.Children)
            .FirstOrDefaultAsync(p => p.FullPath == segPath);

        if (current is not null && i < segments.Length - 1 && current.Secrets.Count > 0)
            return Results.BadRequest($"Path '{segPath}' contains secrets and cannot have subpaths");

        if (current is null)
        {
            current = new SecretPath
            {
                Id = Guid.NewGuid(), ParentId = parentId,
                Name = segments[i], FullPath = segPath
            };
            db.Paths.Add(current);
        }

        parentId = current.Id;
    }

    if (current!.Children.Count > 0)
        return Results.BadRequest($"Path '{fullPath}' has subpaths and cannot contain secrets");

    await db.SaveChangesAsync();

    // Upsert secrets
    foreach (var (key, value) in request.Secrets)
    {
        var plaintext = Encoding.UTF8.GetBytes(value);
        var encrypted = new byte[12 + plaintext.Length + 16];

        int res;
        unsafe
        {
            fixed (byte* pPlaintext = plaintext)
            fixed (byte* pOutput = encrypted)
            {
                res = VaultLibrary.Encrypt(pPlaintext, (nuint)plaintext.Length, pOutput);
            }
        }

        if (res != 0) return Results.StatusCode(500);

        var existing = await db.Secrets
            .FirstOrDefaultAsync(s => s.PathId == current!.Id && s.Key == key);

        if (existing is not null)
        {
            existing.Value = encrypted;
            existing.Version++;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.Secrets.Add(new Secret
            {
                Id = Guid.NewGuid(), PathId = current!.Id,
                Key = key, Value = encrypted
            });
        }
    }

    await db.SaveChangesAsync();
    return Results.Ok(new KvPutResponse(fullPath, request.Secrets.Count));
});

app.MapDelete("/kv/{**path}", async (string path, string? key, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    var fullPath = "/" + path.TrimEnd('/');

    if (key is not null)
    {
        var secret = await db.Secrets
            .Include(s => s.Path)
            .FirstOrDefaultAsync(s => s.Path.FullPath == fullPath && s.Key == key);
        if (secret is null) return Results.NotFound();
        db.Secrets.Remove(secret);
        await db.SaveChangesAsync();
        return Results.Ok();
    }

    var secretPath = await db.Paths.FirstOrDefaultAsync(p => p.FullPath == fullPath);
    if (secretPath is null) return Results.NotFound();
    db.Paths.Remove(secretPath);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// --- Search (fuzzy) ---

app.MapGet("/search", async (string q, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (await ValidateToken(db, token) is null) return Results.Unauthorized();

    var results = await db.Secrets
        .Include(s => s.Path)
        .Where(s => EF.Functions.ILike(s.Path.FullPath + "/" + s.Key, $"%{q}%"))
        .OrderBy(s => s.Path.FullPath)
        .Take(20)
        .Select(s => new SearchResult(s.Path.FullPath, s.Key, s.Version, s.UpdatedAt))
        .ToListAsync();

    var pathResults = await db.Paths
        .Where(p => EF.Functions.ILike(p.FullPath, $"%{q}%"))
        .OrderBy(p => p.FullPath)
        .Take(20)
        .Select(p => new SearchPathResult(p.FullPath, p.Children.Count, p.Secrets.Count))
        .ToListAsync();

    return Results.Ok(new SearchResponse(results, pathResults));
});

// --- Credential management (admin only) ---

app.MapPost("/credential", async (CreateCredentialRequest request, HttpContext ctx, VaultDbContext db) =>
{
    if (!VaultLibrary.IsOpen()) return Results.StatusCode(403);
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    if (request.Kind is not ("app" or "user"))
        return Results.BadRequest("Kind must be 'app' or 'user'");

    var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
    var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    var secretBytes = Encoding.UTF8.GetBytes(secret);
    var hmacOutput = new byte[32];

    unsafe
    {
        fixed (byte* pInput = secretBytes)
        fixed (byte* pOutput = hmacOutput)
        {
            var res = VaultLibrary.Hmac(pInput, (nuint)secretBytes.Length, pOutput);
            if (res != 0) return Results.StatusCode(500);
        }
    }

    db.Credentials.Add(new Credential
    {
        Id = id, Name = request.Name, Kind = request.Kind,
        SecretHmac = Convert.ToHexString(hmacOutput)
    });
    await db.SaveChangesAsync();

    return Results.Ok(new CreateCredentialResponse(id, secret, request.Name, request.Kind));
});

app.MapGet("/credential", async (HttpContext ctx, VaultDbContext db) =>
{
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    var creds = await db.Credentials
        .Select(c => new CredentialInfo(c.Id, c.Name, c.Kind, c.CreatedAt))
        .ToArrayAsync();

    return Results.Ok(new CredentialListResponse(creds));
});

app.MapDelete("/credential/{id}", async (string id, HttpContext ctx, VaultDbContext db) =>
{
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    var cred = await db.Credentials.FindAsync(id);
    if (cred is null) return Results.NotFound();
    db.Credentials.Remove(cred);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// --- Token management (admin only) ---

app.MapPost("/token", async (CreateTokenRequest request, HttpContext ctx, VaultDbContext db) =>
{
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    var newTokenValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    db.Tokens.Add(new Token { Id = newTokenValue, Name = request.Name, Role = "app" });
    await db.SaveChangesAsync();

    return Results.Ok(new CreateTokenResponse(newTokenValue, request.Name));
});

app.MapDelete("/token/{tokenToRevoke}", async (string tokenToRevoke, HttpContext ctx, VaultDbContext db) =>
{
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();
    if (token == tokenToRevoke) return Results.BadRequest("Cannot revoke your own token");

    var t = await db.Tokens.FindAsync(tokenToRevoke);
    if (t is null) return Results.NotFound();
    db.Tokens.Remove(t);
    await db.SaveChangesAsync();
    return Results.Ok();
});

app.MapGet("/token", async (HttpContext ctx, VaultDbContext db) =>
{
    var token = GetBearerToken(ctx);
    if (!await IsAdmin(db, token)) return Results.Unauthorized();

    var tokens = await db.Tokens
        .Select(t => new TokenInfo(t.Id, t.Name, t.Role, t.CreatedAt, t.ExpiresAt))
        .ToArrayAsync();

    return Results.Ok(new TokenListResponse(tokens));
});

app.MapPost("/admin-token", async (AdminTokenRequest request, VaultDbContext db) =>
{
    if (request.Shards.Length < request.Threshold)
        return Results.BadRequest("Not enough shards");

    var shardsBuffer = new byte[request.Threshold * 33];
    for (int i = 0; i < request.Threshold; i++)
    {
        var shardBytes = Convert.FromHexString(request.Shards[i]);
        if (shardBytes.Length != 33)
            return Results.BadRequest($"Invalid shard length for shard {i}");
        shardBytes.CopyTo(shardsBuffer.AsSpan(i * 33));
    }

    var hashBuffer = Convert.FromHexString(request.Hash);
    if (hashBuffer.Length != 32) return Results.BadRequest("Invalid hash length");

    int res;
    unsafe
    {
        fixed (byte* pShards = shardsBuffer)
        fixed (byte* pHash = hashBuffer)
        {
            res = VaultLibrary.Unseal(pShards, request.Threshold, pHash);
        }
    }

    if (res != 0) return Results.Unauthorized();

    var adminToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    db.Tokens.Add(new Token { Id = adminToken, Name = "admin", Role = "admin" });
    await db.SaveChangesAsync();

    return Results.Ok(new AdminTokenResponse(adminToken));
});

app.Run();
