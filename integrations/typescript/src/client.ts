export interface VaultClientOptions {
  addr: string;
  token?: string;
  appId?: string;
  appSecret?: string;
}

export interface KvSecrets {
  path: string;
  secrets: Record<string, string>;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
}

export class VaultClient {
  private addr: string;
  private token: string | null;
  private appId: string | null;
  private appSecret: string | null;
  private tokenExpiresAt: number | null = null;

  constructor(opts: VaultClientOptions) {
    this.addr = opts.addr.replace(/\/$/, "");
    this.token = opts.token ?? null;
    this.appId = opts.appId ?? null;
    this.appSecret = opts.appSecret ?? null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
    };

    const token = await this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.addr}${path}`, {
      ...init,
      headers,
    });

    if (res.status === 403) throw new VaultError("Vault is sealed", 403);
    if (res.status === 401) throw new VaultError("Unauthorized", 401);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new VaultError(body || `HTTP ${res.status}`, res.status);
    }

    return res.json() as Promise<T>;
  }

  private async getToken(): Promise<string | null> {
    if (this.token && !this.isTokenExpired()) {
      return this.token;
    }

    if (this.appId && this.appSecret) {
      await this.authenticate();
      return this.token;
    }

    return this.token;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false;
    return Date.now() > this.tokenExpiresAt - 30_000; // 30s buffer
  }

  private async authenticate(): Promise<void> {
    const res = await fetch(`${this.addr}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: this.appId, secret: this.appSecret }),
    });

    if (!res.ok) {
      throw new VaultError(`Authentication failed: HTTP ${res.status}`, res.status);
    }

    const data = (await res.json()) as AuthResponse;
    this.token = data.token;
    this.tokenExpiresAt = new Date(data.expiresAt).getTime();
  }

  async status(): Promise<number> {
    const data = await this.request<{ status: number }>("/version");
    return data.status;
  }

  async get(path: string): Promise<Record<string, string>> {
    const clean = path.replace(/^\//, "");
    const data = await this.request<KvSecrets>(`/kv/${clean}`);
    return data.secrets;
  }

  async getKey(path: string, key: string): Promise<string> {
    const secrets = await this.get(path);
    if (!(key in secrets)) {
      throw new VaultError(`Key "${key}" not found at path "${path}"`, 404);
    }
    return secrets[key];
  }

  async put(path: string, secrets: Record<string, string>): Promise<void> {
    const clean = path.replace(/^\//, "");
    await this.request(`/kv/${clean}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secrets }),
    });
  }
}

export class VaultError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "VaultError";
  }
}
