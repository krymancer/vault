import { createSignal, Show, For } from "solid-js";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { api, type InitResponse } from "../api";

export default function Init() {
  const queryClient = useQueryClient();
  const [count, setCount] = createSignal(5);
  const [threshold, setThreshold] = createSignal(3);
  const [result, setResult] = createSignal<InitResponse | null>(null);

  const mutation = createMutation(() => ({
    mutationFn: () => api.init(count(), threshold()),
    onSuccess: (data) => {
      setResult(data);
      localStorage.setItem("vault_token", data.rootToken);
      queryClient.invalidateQueries({ queryKey: ["version"] });
    },
  }));

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Initialize Vault</h1>

      <Show when={!result()}>
        <div class="bg-vault-surface border border-vault-border rounded-lg p-6 max-w-md">
          <p class="text-sm text-vault-text-muted mb-4">
            Generate master key shards using Shamir's Secret Sharing.
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-vault-text-muted mb-1">Key shares</label>
              <input
                type="number"
                min="2"
                max="255"
                value={count()}
                onInput={(e) => setCount(parseInt(e.currentTarget.value) || 5)}
                class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
              />
            </div>
            <div>
              <label class="block text-xs text-vault-text-muted mb-1">Key threshold</label>
              <input
                type="number"
                min="2"
                max={count()}
                value={threshold()}
                onInput={(e) => setThreshold(parseInt(e.currentTarget.value) || 3)}
                class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
              />
            </div>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Initializing..." : "Initialize"}
            </button>
          </div>

          <Show when={mutation.isError}>
            <p class="mt-3 text-vault-danger text-sm">{(mutation.error as Error).message}</p>
          </Show>
        </div>
      </Show>

      <Show when={result()}>
        {(res) => (
          <div class="space-y-4 max-w-3xl">
            <div class="bg-vault-success/10 border border-vault-success/30 rounded-lg p-4">
              <p class="text-vault-success text-sm font-medium">Vault initialized successfully</p>
            </div>

            <div class="bg-vault-surface border border-vault-border rounded-lg p-5">
              <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-2">Root Token</p>
              <code class="text-xs break-all bg-vault-bg p-2 rounded block">{res().rootToken}</code>
            </div>

            <div class="bg-vault-surface border border-vault-border rounded-lg p-5">
              <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-2">Hash</p>
              <code class="text-xs break-all bg-vault-bg p-2 rounded block">{res().hash}</code>
            </div>

            <div class="bg-vault-surface border border-vault-border rounded-lg p-5">
              <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-3">
                Unseal Keys
              </p>
              <div class="space-y-2">
                <For each={res().shards}>
                  {(shard, i) => (
                    <div class="flex items-center gap-2">
                      <span class="text-vault-text-muted text-xs w-4">{i() + 1}</span>
                      <code class="text-xs break-all bg-vault-bg p-2 rounded flex-1">
                        {shard}
                      </code>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="bg-vault-warning/10 border border-vault-warning/30 rounded-lg p-4">
              <p class="text-vault-warning text-sm">
                Save these keys securely. You will need {threshold()} of {count()} keys to unseal.
              </p>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
