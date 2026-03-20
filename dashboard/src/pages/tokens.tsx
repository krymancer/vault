import { createSignal, Show, For } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { api } from "../api";

export default function Tokens() {
  const queryClient = useQueryClient();
  const [name, setName] = createSignal("");
  const [createdToken, setCreatedToken] = createSignal("");

  const tokens = createQuery(() => ({
    queryKey: ["tokens"],
    queryFn: api.listTokens,
  }));

  const createToken = createMutation(() => ({
    mutationFn: () => api.createToken(name()),
    onSuccess: (data) => {
      setCreatedToken(data.token);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
  }));

  const revokeToken = createMutation(() => ({
    mutationFn: (token: string) => api.revokeToken(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tokens"] }),
  }));

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Tokens</h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-4">Create Token</p>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-vault-text-muted mb-1">Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Token name..."
                class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
              />
            </div>
            <button
              onClick={() => { setCreatedToken(""); createToken.mutate(); }}
              disabled={createToken.isPending || !name().trim()}
              class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {createToken.isPending ? "Creating..." : "Create Token"}
            </button>
          </div>

          <Show when={createdToken()}>
            <div class="mt-4">
              <div class="bg-vault-warning/10 border border-vault-warning/30 rounded-lg p-3 mb-2">
                <p class="text-vault-warning text-xs">Save this token now.</p>
              </div>
              <code class="text-xs break-all bg-vault-bg p-2 rounded block">{createdToken()}</code>
            </div>
          </Show>

          <Show when={createToken.isError}>
            <p class="mt-3 text-vault-danger text-sm">{(createToken.error as Error).message}</p>
          </Show>
        </div>

        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-4">Active Tokens</p>

          <Show
            when={tokens.data?.tokens?.length}
            fallback={<p class="text-sm text-vault-text-muted">No tokens</p>}
          >
            <div class="space-y-2">
              <For each={tokens.data?.tokens}>
                {(t) => (
                  <div class="flex items-center justify-between bg-vault-bg rounded p-3">
                    <div>
                      <p class="text-sm font-medium">{t.name}</p>
                      <p class="text-xs text-vault-text-muted">
                        {t.role} &middot; {t.token.slice(0, 8)}...
                        {t.expiresAt ? ` · exp ${new Date(t.expiresAt).toLocaleString()}` : " · no expiry"}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeToken.mutate(t.token)}
                      class="text-xs text-vault-danger hover:text-vault-danger/80 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
