const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("vault_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 403) throw new Error("Vault is sealed");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export interface VersionResponse {
  status: number;
}

export interface InitResponse {
  shards: string[];
  hash: string;
  rootToken: string;
}

export interface UnsealResponse {
  success: boolean;
}

export interface EncryptResponse {
  ciphertext: string;
}

export interface DecryptResponse {
  plaintext: string;
}

export interface CreateCredentialResponse {
  id: string;
  secret: string;
  name: string;
  kind: string;
}

export interface CredentialInfo {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
}

export interface TokenInfo {
  token: string;
  name: string;
  role: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface KvGetResponse {
  path: string;
  secrets: Record<string, string>;
}

export interface KvListItem {
  name: string;
  fullPath: string;
  type: "directory" | "secret";
  secretCount: number;
  childCount: number;
}

export interface KvListResponse {
  path: string;
  items: KvListItem[];
}

export type KvBrowseResult =
  | { kind: "directory"; data: KvListResponse }
  | { kind: "leaf"; data: KvGetResponse };

export interface KvPutResponse {
  path: string;
  count: number;
}

export interface SearchResult {
  path: string;
  key: string;
  version: number;
  updatedAt: string;
}

export interface SearchPathResult {
  path: string;
  childCount: number;
  secretCount: number;
}

export interface SearchResponse {
  secrets: SearchResult[];
  paths: SearchPathResult[];
}

export const api = {
  version: () => request<VersionResponse>("/version"),

  init: (count: number, threshold: number) =>
    request<InitResponse>("/init", {
      method: "POST",
      body: JSON.stringify({ count, threshold }),
    }),

  unseal: (shards: string[], threshold: number, hash: string) =>
    request<UnsealResponse>("/unseal", {
      method: "POST",
      body: JSON.stringify({ shards, threshold, hash }),
    }),

  encrypt: (plaintext: string) =>
    request<EncryptResponse>("/encrypt", {
      method: "POST",
      body: JSON.stringify({ plaintext }),
    }),

  decrypt: (ciphertext: string) =>
    request<DecryptResponse>("/decrypt", {
      method: "POST",
      body: JSON.stringify({ ciphertext }),
    }),

  auth: (id: string, secret: string) =>
    request<AuthResponse>("/auth", {
      method: "POST",
      body: JSON.stringify({ id, secret }),
    }),

  createCredential: (name: string, kind: string) =>
    request<CreateCredentialResponse>("/credential", {
      method: "POST",
      body: JSON.stringify({ name, kind }),
    }),

  listCredentials: () =>
    request<{ credentials: CredentialInfo[] }>("/credential"),

  deleteCredential: (id: string) =>
    request<void>(`/credential/${id}`, { method: "DELETE" }),

  createToken: (name: string) =>
    request<{ token: string; name: string }>("/token", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  listTokens: () => request<{ tokens: TokenInfo[] }>("/token"),

  revokeToken: (token: string) =>
    request<void>(`/token/${token}`, { method: "DELETE" }),

  adminToken: (shards: string[], threshold: number, hash: string) =>
    request<{ token: string }>("/admin-token", {
      method: "POST",
      body: JSON.stringify({ shards, threshold, hash }),
    }),

  kvList: (path?: string) =>
    request<KvListResponse>(path ? `/kv/${path}` : "/kv"),

  kvGet: (path: string) => request<KvGetResponse>(`/kv/${path}`),

  kvBrowse: async (path?: string): Promise<KvBrowseResult> => {
    const url = path ? `/kv/${path}` : "/kv";
    const data = await request<any>(url);
    if ("items" in data) return { kind: "directory", data: data as KvListResponse };
    return { kind: "leaf", data: data as KvGetResponse };
  },

  kvPut: (path: string, secrets: Record<string, string>) =>
    request<KvPutResponse>(`/kv/${path}`, {
      method: "PUT",
      body: JSON.stringify({ secrets }),
    }),

  kvDelete: (path: string, key?: string) =>
    request<void>(`/kv/${path}${key ? `?key=${key}` : ""}`, {
      method: "DELETE",
    }),

  search: (q: string) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
};
