using System.Text;
using Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default);
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

static string? GetBearerToken(HttpContext ctx)
{
    var header = ctx.Request.Headers.Authorization.ToString();
    if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        return header["Bearer ".Length..];
    return null;
}

app.MapGet("/version", static () =>
{
    var v = VaultLibrary.IsOpen() ? VaultStatus.Operational : VaultStatus.Closed;
    return Results.Ok(new VersionResponse(v));
});

app.MapPost("/init", (InitRequest request) =>
{
    if (request.Count < request.Threshold || request.Threshold < 2)
    {
        return Results.BadRequest("Invalid count or threshold");
    }

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

    if (res != 0)
    {
        return Results.StatusCode(500);
    }

    var shards = new string[request.Count];
    for (int i = 0; i < request.Count; i++)
    {
        shards[i] = Convert.ToHexString(shardsBuffer.AsSpan(i * 33, 33));
    }

    TokenStore.Clear();
    var rootToken = TokenStore.CreateToken("root", "admin");

    return Results.Ok(new InitResponse(shards, Convert.ToHexString(hashBuffer), rootToken));
});

app.MapPost("/unseal", (UnsealRequest request) =>
{
    if (request.Shards.Length < request.Threshold)
    {
        return Results.BadRequest("Not enough shards");
    }

    var shardsBuffer = new byte[request.Threshold * 33];
    for (int i = 0; i < request.Threshold; i++)
    {
        var shardBytes = Convert.FromHexString(request.Shards[i]);
        if (shardBytes.Length != 33)
        {
            return Results.BadRequest($"Invalid shard length for shard {i}");
        }
        shardBytes.CopyTo(shardsBuffer.AsSpan(i * 33));
    }

    var hashBuffer = Convert.FromHexString(request.Hash);
    if (hashBuffer.Length != 32)
    {
        return Results.BadRequest("Invalid hash length");
    }

    int res;
    unsafe
    {
        fixed (byte* pShards = shardsBuffer)
        fixed (byte* pHash = hashBuffer)
        {
            res = VaultLibrary.Unseal(pShards, request.Threshold, pHash);
        }
    }

    if (res != 0)
    {
        return Results.Ok(new UnsealResponse(false));
    }

    return Results.Ok(new UnsealResponse(true));
});

app.MapPost("/encrypt", (EncryptRequest request, HttpContext ctx) =>
{
    if (!VaultLibrary.IsOpen())
    {
        return Results.StatusCode(403);
    }

    var token = GetBearerToken(ctx);
    if (token is null || TokenStore.Validate(token) is null)
    {
        return Results.Unauthorized();
    }

    var plaintext = Encoding.UTF8.GetBytes(request.Plaintext);
    // Nonce(12) + Plaintext + Tag(16)
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

    if (res != 0)
    {
        return Results.StatusCode(500);
    }

    return Results.Ok(new EncryptResponse(Convert.ToHexString(output)));
});

app.MapPost("/decrypt", (DecryptRequest request, HttpContext ctx) =>
{
    if (!VaultLibrary.IsOpen())
    {
        return Results.StatusCode(403);
    }

    var token = GetBearerToken(ctx);
    if (token is null || TokenStore.Validate(token) is null)
    {
        return Results.Unauthorized();
    }

    var ciphertext = Convert.FromHexString(request.Ciphertext);
    if (ciphertext.Length < 12 + 16)
    {
        return Results.BadRequest("Invalid ciphertext length");
    }

    var plaintextLen = ciphertext.Length - 12 - 16;
    var output = new byte[plaintextLen];

    int res;
    unsafe
    {
        fixed (byte* pCiphertext = ciphertext)
        fixed (byte* pOutput = output)
        {
            res = VaultLibrary.Decrypt(pCiphertext, (nuint)ciphertext.Length, pOutput);
        }
    }

    if (res == -3)
    {
        return Results.BadRequest("Authentication failed: ciphertext is invalid or tampered");
    }

    if (res != 0)
    {
        return Results.StatusCode(500);
    }

    return Results.Ok(new DecryptResponse(Encoding.UTF8.GetString(output)));
});

app.MapPost("/token", (CreateTokenRequest request, HttpContext ctx) =>
{
    var token = GetBearerToken(ctx);
    if (token is null || !TokenStore.IsAdmin(token))
    {
        return Results.Unauthorized();
    }

    var newToken = TokenStore.CreateToken(request.Name, "app");
    return Results.Ok(new CreateTokenResponse(newToken, request.Name));
});

app.MapDelete("/token/{tokenToRevoke}", (string tokenToRevoke, HttpContext ctx) =>
{
    var token = GetBearerToken(ctx);
    if (token is null || !TokenStore.IsAdmin(token))
    {
        return Results.Unauthorized();
    }

    if (token == tokenToRevoke)
    {
        return Results.BadRequest("Cannot revoke your own token");
    }

    return TokenStore.Revoke(tokenToRevoke) ? Results.Ok() : Results.NotFound();
});

app.MapGet("/token", (HttpContext ctx) =>
{
    var token = GetBearerToken(ctx);
    if (token is null || !TokenStore.IsAdmin(token))
    {
        return Results.Unauthorized();
    }

    var tokens = TokenStore.All()
        .Select(t => new TokenInfo(t.Token, t.Entry.Name, t.Entry.Role, t.Entry.CreatedAt))
        .ToArray();

    return Results.Ok(new TokenListResponse(tokens));
});

app.MapPost("/admin-token", (AdminTokenRequest request) =>
{
    if (request.Shards.Length < request.Threshold)
    {
        return Results.BadRequest("Not enough shards");
    }

    var shardsBuffer = new byte[request.Threshold * 33];
    for (int i = 0; i < request.Threshold; i++)
    {
        var shardBytes = Convert.FromHexString(request.Shards[i]);
        if (shardBytes.Length != 33)
        {
            return Results.BadRequest($"Invalid shard length for shard {i}");
        }
        shardBytes.CopyTo(shardsBuffer.AsSpan(i * 33));
    }

    var hashBuffer = Convert.FromHexString(request.Hash);
    if (hashBuffer.Length != 32)
    {
        return Results.BadRequest("Invalid hash length");
    }

    int res;
    unsafe
    {
        fixed (byte* pShards = shardsBuffer)
        fixed (byte* pHash = hashBuffer)
        {
            res = VaultLibrary.Unseal(pShards, request.Threshold, pHash);
        }
    }

    if (res != 0)
    {
        return Results.Unauthorized();
    }

    var adminToken = TokenStore.CreateToken("admin", "admin");
    return Results.Ok(new AdminTokenResponse(adminToken));
});

app.Run();
