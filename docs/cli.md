# Vault CLI Reference

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VAULT_ADDR` | `http://localhost:5045` | Vault API base URL |
| `VAULT_TOKEN` | — | Bearer token for authenticated commands |

## Commands

### `vault status`

Check if the vault is sealed or operational.

```sh
$ vault status
OPERATIONAL
```

---

### `vault init <count> <threshold>`

Initialize the vault with Shamir's Secret Sharing.

```sh
$ vault init 5 3
Root Token: DEF0...

Hash: 9ABC...

Shards:
  1: AB01...
  2: CD02...
  3: EF03...
  4: 1234...
  5: 5678...
```

| Argument  | Description |
|-----------|-------------|
| count     | Total number of key shards (2–255) |
| threshold | Minimum shards to unseal (2–count) |

Save the shards securely. Re-initializing an existing vault destroys all data.

---

### `vault unseal <threshold> <hash> <shard1> <shard2> ...`

Unseal the vault by reconstructing the master key from shards.

```sh
$ vault unseal 3 9ABC... AB01... CD02... EF03...
UNSEALED
```

---

### `vault admin-token <threshold> <hash> <shard1> <shard2> ...`

Generate an admin token using key shards. Recovery mechanism when no valid tokens exist.

```sh
$ vault admin-token 3 9ABC... AB01... CD02... EF03...
Admin Token: DEF0...
```

---

### `vault auth <id> <secret>`

Authenticate with a credential and receive a time-limited token.

```sh
$ vault auth A1B2C3... D4E5F6...
Token:   7890AB...
Expires: 2026-03-20T13:00:00Z
```

Requires: vault unsealed.

---

### `vault encrypt <plaintext>`

Encrypt a string with the vault's master key (AES-256-GCM).

```sh
$ export VAULT_TOKEN=DEF0...
$ vault encrypt "my secret"
0A1B2C3D...
```

### `vault decrypt <ciphertext>`

Decrypt a hex-encoded ciphertext.

```sh
$ vault decrypt 0A1B2C3D...
my secret
```

---

### `vault kv list [path]`

List paths at root or under a given path. Handles both directory listings and leaf secrets.

```sh
$ vault kv list
Path: /
  production/  (3 paths)
  shared       (2 secrets)

$ vault kv list production
Path: /production
  api          (5 secrets)
  worker       (3 secrets)
```

### `vault kv get <path>`

Read secrets at a path. If the path is a directory, shows child paths instead.

```sh
$ vault kv get production/api
Path: /production/api
  DB_HOST = db.example.com
  DB_PASSWORD = s3cret
```

### `vault kv put <path> <key=value> [key=value ...]`

Write one or more secrets to a path. Creates intermediate path segments automatically.

```sh
$ vault kv put production/api DB_HOST=db.example.com DB_PASSWORD=s3cret
Wrote 2 secret(s) to /production/api
```

### `vault kv delete <path> [key]`

Delete an entire path or a single secret key. Requires admin token.

```sh
$ vault kv delete production/api DB_PASSWORD
DELETED

$ vault kv delete production/api
DELETED
```

---

### `vault search <query>`

Fuzzy search across paths and secret keys.

```sh
$ vault search prod
Paths:
  /production  (2 children, 0 secrets)
Secrets:
  /production/api/DB_HOST  (v1)
```

---

### `vault credential create <name> <app|user>`

Create a new credential. Requires admin token.

```sh
$ vault credential create my-service app
Id:     A1B2C3...
Secret: D4E5F6...
Name:   my-service
Kind:   app
```

Save the secret — it is only shown once.

### `vault credential list`

List all credentials. Requires admin token.

```sh
$ vault credential list
  A1B2C3...  my-service  [app]
```

### `vault credential delete <id>`

Delete a credential. Requires admin token.

---

### `vault token create <name>`

Create a new app-role token. Requires admin token.

```sh
$ vault token create ci-pipeline
Token: 7890AB...
Name:  ci-pipeline
```

### `vault token list`

List all tokens. Requires admin token.

```sh
$ vault token list
  7890AB1234567890...  ci-pipeline  [app]  expires: never
```

### `vault token revoke <token>`

Revoke a token. Cannot revoke your own token. Requires admin token.
