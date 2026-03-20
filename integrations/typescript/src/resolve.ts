import { VaultClient, type VaultClientOptions } from "./client.js";

const VAULT_PREFIX = "vault:";

export interface ResolveOptions extends VaultClientOptions {
  /** Environment variables to resolve. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

/**
 * Parse a vault reference string.
 * Format: `vault:path/to/secrets#key`
 */
function parseRef(value: string): { path: string; key: string } | null {
  if (!value.startsWith(VAULT_PREFIX)) return null;

  const rest = value.slice(VAULT_PREFIX.length);
  const hashIdx = rest.indexOf("#");
  if (hashIdx === -1) return null;

  const path = rest.slice(0, hashIdx);
  const key = rest.slice(hashIdx + 1);
  if (!path || !key) return null;

  return { path, key };
}

/**
 * Scan environment variables for vault references and resolve them.
 *
 * Returns a new object with all vault references replaced by their secret values.
 * Non-vault env vars are passed through unchanged.
 *
 * ```ts
 * const env = await resolve({
 *   addr: "http://localhost:5045",
 *   appId: process.env.VAULT_APP_ID,
 *   appSecret: process.env.VAULT_APP_SECRET,
 * });
 *
 * // env.DATABASE_HOST is now the actual secret value
 * ```
 */
export async function resolve(
  opts: ResolveOptions,
): Promise<Record<string, string>> {
  const env = opts.env ?? (process.env as Record<string, string | undefined>);
  const client = new VaultClient(opts);

  // Collect all vault refs, grouped by path for batching
  const refs: { envKey: string; path: string; secretKey: string }[] = [];
  const paths = new Set<string>();

  for (const [envKey, value] of Object.entries(env)) {
    if (!value) continue;
    const parsed = parseRef(value);
    if (parsed) {
      refs.push({ envKey, path: parsed.path, secretKey: parsed.key });
      paths.add(parsed.path);
    }
  }

  // Batch fetch — one request per unique path
  const cache = new Map<string, Record<string, string>>();
  await Promise.all(
    [...paths].map(async (path) => {
      const secrets = await client.get(path);
      cache.set(path, secrets);
    }),
  );

  // Build resolved env
  const result: Record<string, string> = {};

  for (const [envKey, value] of Object.entries(env)) {
    if (!value) continue;

    const parsed = parseRef(value);
    if (!parsed) {
      result[envKey] = value;
      continue;
    }

    const secrets = cache.get(parsed.path);
    if (!secrets) {
      throw new Error(
        `Vault path "${parsed.path}" not found (referenced by ${envKey})`,
      );
    }

    if (!(parsed.key in secrets)) {
      throw new Error(
        `Key "${parsed.key}" not found at vault path "${parsed.path}" (referenced by ${envKey})`,
      );
    }

    result[envKey] = secrets[parsed.key];
  }

  return result;
}
