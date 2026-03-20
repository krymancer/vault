import { createSignal, Show } from "solid-js";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { api } from "../api";

export default function Auth() {
  const queryClient = useQueryClient();
  const [id, setId] = createSignal("");
  const [secret, setSecret] = createSignal("");

  const mutation = createMutation(() => ({
    mutationFn: () => api.auth(id(), secret()),
    onSuccess: (data) => {
      localStorage.setItem("vault_token", data.token);
      queryClient.invalidateQueries({ queryKey: ["version"] });
    },
  }));

  const token = () => localStorage.getItem("vault_token");

  const logout = () => {
    localStorage.removeItem("vault_token");
    queryClient.invalidateQueries({ queryKey: ["version"] });
  };

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Auth</h1>

      <Show when={token()}>
        <div class="bg-vault-surface border border-vault-border rounded-lg p-5 max-w-md mb-4">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-2">Current Token</p>
          <code class="text-xs break-all bg-vault-bg p-2 rounded block mb-3">{token()}</code>
          <button
            onClick={logout}
            class="text-xs text-vault-danger hover:text-vault-danger/80 transition-colors"
          >
            Clear token
          </button>
        </div>
      </Show>

      <div class="bg-vault-surface border border-vault-border rounded-lg p-6 max-w-md">
        <p class="text-sm text-vault-text-muted mb-4">
          Authenticate with credential ID and secret to get a token.
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-vault-text-muted mb-1">Credential ID</label>
            <input
              type="text"
              value={id()}
              onInput={(e) => setId(e.currentTarget.value)}
              placeholder="Enter credential ID..."
              class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent"
            />
          </div>
          <div>
            <label class="block text-xs text-vault-text-muted mb-1">Secret</label>
            <input
              type="password"
              value={secret()}
              onInput={(e) => setSecret(e.currentTarget.value)}
              placeholder="Enter secret..."
              class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent"
            />
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !id().trim() || !secret().trim()}
            class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? "Authenticating..." : "Authenticate"}
          </button>
        </div>

        <Show when={mutation.isSuccess}>
          <div class="mt-4 bg-vault-success/10 border border-vault-success/30 rounded-lg p-3">
            <p class="text-vault-success text-sm">Token set successfully. Expires at {mutation.data?.expiresAt}.</p>
          </div>
        </Show>

        <Show when={mutation.isError}>
          <p class="mt-3 text-vault-danger text-sm">{(mutation.error as Error).message}</p>
        </Show>
      </div>
    </div>
  );
}
