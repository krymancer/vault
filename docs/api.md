# Vault API Reference

Base URL: `http://localhost:5045` (configurable via `ConnectionStrings__Default` in docker-compose)

## Authentication

Most endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained via `/init` (root token), `/auth` (credential-based), `/token` (admin-created), or `/admin-token` (shard-based recovery).

## Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 400  | Bad request (invalid input) |
| 401  | Unauthorized (missing/invalid/expired token) |
| 403  | Vault is sealed |
| 404  | Resource not found |
| 500  | Internal server error |

---

## Status

### `GET /version`

Returns the current vault status. No authentication required.

**Response:**

```json
{ "status": 0 }
```

| Status | Meaning |
|--------|---------|
| 0      | Sealed / uninitialized |
| 1      | Unsealed (operational) |

---

## Init & Unseal

### `POST /init`

Initialize the vault with Shamir's Secret Sharing. Generates a master key, splits it into shards, and returns a root admin token.

If the vault is already initialized, this **re-initializes** it — all existing secrets, tokens, and credentials are permanently deleted.

**Request:**

```json
{
  "count": 5,
  "threshold": 3
}
```

| Field     | Type | Description |
|-----------|------|-------------|
| count     | int  | Total number of key shards to generate (2–255) |
| threshold | int  | Minimum shards needed to unseal (2–count) |

**Response:**

```json
{
  "shards": ["AB01...", "CD02...", "EF03...", "1234...", "5678..."],
  "hash": "9ABC...",
  "rootToken": "DEF0..."
}
```

| Field     | Type     | Description |
|-----------|----------|-------------|
| shards    | string[] | Hex-encoded key shards (each 33 bytes / 66 hex chars) |
| hash      | string   | Hex-encoded SHA-256 hash of the master key (32 bytes / 64 hex chars) |
| rootToken | string   | Admin token (auto-saved to DB) |

### `POST /unseal`

Reconstruct the master key from shards and unseal the vault.

**Request:**

```json
{
  "shards": ["AB01...", "CD02...", "EF03..."],
  "threshold": 3,
  "hash": "9ABC..."
}
```

| Field     | Type     | Description |
|-----------|----------|-------------|
| shards    | string[] | Hex-encoded shards (at least `threshold` count) |
| threshold | int      | Number of shards required |
| hash      | string   | Expected master key hash |

**Response:**

```json
{ "success": true }
```

### `POST /admin-token`

Generate a new admin token by proving possession of the key shards. Useful as a recovery mechanism when no valid tokens exist. Also unseals the vault if sealed.

**Request:** Same as `/unseal`.

**Response:**

```json
{ "token": "DEF0..." }
```

---

## Authentication

### `POST /auth`

Authenticate with a credential (app or user) and receive a time-limited token.

**Requires:** Vault unsealed.

**Request:**

```json
{
  "id": "A1B2C3...",
  "secret": "D4E5F6..."
}
```

**Response:**

```json
{
  "token": "7890AB...",
  "expiresAt": "2026-03-20T13:00:00Z"
}
```

Tokens expire after 1 hour.

---

## Encryption

### `POST /encrypt`

Encrypt plaintext using the vault's master key (AES-256-GCM).

**Requires:** Bearer token, vault unsealed.

**Request:**

```json
{ "plaintext": "my secret data" }
```

**Response:**

```json
{ "ciphertext": "0A1B2C..." }
```

The ciphertext is hex-encoded and contains: 12-byte nonce + encrypted data + 16-byte GCM auth tag.

### `POST /decrypt`

Decrypt a previously encrypted ciphertext.

**Requires:** Bearer token, vault unsealed.

**Request:**

```json
{ "ciphertext": "0A1B2C..." }
```

**Response:**

```json
{ "plaintext": "my secret data" }
```

Returns `400` if the ciphertext is tampered or invalid.

---

## KV Secrets

Hierarchical key-value secret storage with filesystem-like paths. A path is either a **directory** (has child paths) or a **leaf** (has secrets) — never both.

### `GET /kv`

List root-level paths.

**Requires:** Bearer token, vault unsealed.

**Response:**

```json
{
  "path": "/",
  "items": [
    {
      "name": "production",
      "fullPath": "/production",
      "type": "directory",
      "secretCount": 0,
      "childCount": 3
    },
    {
      "name": "shared",
      "fullPath": "/shared",
      "type": "secret",
      "secretCount": 2,
      "childCount": 0
    }
  ]
}
```

### `GET /kv/{path}`

Browse a path. Returns a **directory listing** if the path has children, or **decrypted secrets** if it's a leaf.

**Requires:** Bearer token, vault unsealed.

**Directory response** (has `items`):

```json
{
  "path": "/production",
  "items": [
    { "name": "api", "fullPath": "/production/api", "type": "secret", "secretCount": 5, "childCount": 0 }
  ]
}
```

**Leaf response** (has `secrets`):

```json
{
  "path": "/production/api",
  "secrets": {
    "DB_HOST": "db.example.com",
    "DB_PASSWORD": "s3cret"
  }
}
```

Clients can distinguish response type by checking for `"items"` vs `"secrets"` in the JSON.

### `PUT /kv/{path}`

Create or update secrets at a path. Intermediate path segments are created automatically.

**Requires:** Bearer token, vault unsealed.

**Request:**

```json
{
  "secrets": {
    "DB_HOST": "db.example.com",
    "DB_PASSWORD": "s3cret"
  }
}
```

**Response:**

```json
{ "path": "/production/api", "count": 2 }
```

**Errors:**
- `400` if a parent path already contains secrets (directory/leaf conflict)
- `400` if the target path has child paths (directory/leaf conflict)

### `DELETE /kv/{path}?key={key}`

Delete a single secret key or an entire path (cascades to all children).

**Requires:** Admin token, vault unsealed.

| Parameter | Required | Description |
|-----------|----------|-------------|
| path      | yes      | The path to delete from |
| key       | no       | If provided, deletes only this key. Otherwise deletes the entire path. |

---

## Search

### `GET /search?q={query}`

Fuzzy search across paths and secret keys. Uses PostgreSQL `pg_trgm` for trigram matching.

**Requires:** Bearer token, vault unsealed.

**Response:**

```json
{
  "secrets": [
    { "path": "/production/api", "key": "DB_PASSWORD", "version": 1, "updatedAt": "2026-03-20T12:00:00Z" }
  ],
  "paths": [
    { "path": "/production", "childCount": 2, "secretCount": 0 }
  ]
}
```

Results are limited to 20 per category.

---

## Credentials (Admin)

### `POST /credential`

Create an app or user credential. Returns a one-time-visible secret.

**Requires:** Admin token, vault unsealed.

**Request:**

```json
{ "name": "my-service", "kind": "app" }
```

| Field | Type   | Description |
|-------|--------|-------------|
| name  | string | Display name |
| kind  | string | `"app"` or `"user"` |

**Response:**

```json
{
  "id": "A1B2C3...",
  "secret": "D4E5F6...",
  "name": "my-service",
  "kind": "app"
}
```

The secret is HMAC'd and only the hash is stored. The plaintext secret is only returned once.

### `GET /credential`

List all credentials (without secrets).

**Requires:** Admin token.

**Response:**

```json
{
  "credentials": [
    { "id": "A1B2C3...", "name": "my-service", "kind": "app", "createdAt": "2026-03-20T12:00:00Z" }
  ]
}
```

### `DELETE /credential/{id}`

Delete a credential.

**Requires:** Admin token.

---

## Tokens (Admin)

### `POST /token`

Create a new app-role token (no expiration).

**Requires:** Admin token.

**Request:**

```json
{ "name": "ci-pipeline" }
```

**Response:**

```json
{ "token": "7890AB...", "name": "ci-pipeline" }
```

### `GET /token`

List all tokens.

**Requires:** Admin token.

**Response:**

```json
{
  "tokens": [
    { "token": "7890AB...", "name": "ci-pipeline", "role": "app", "createdAt": "2026-03-20T12:00:00Z", "expiresAt": null }
  ]
}
```

### `DELETE /token/{token}`

Revoke a token. Cannot revoke your own token.

**Requires:** Admin token.
