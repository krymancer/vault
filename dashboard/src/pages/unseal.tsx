import { createSignal, Show, For } from "solid-js";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@solidjs/router";
import { api } from "../api";

export default function Unseal() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [threshold, setThreshold] = createSignal(3);
  const [hash, setHash] = createSignal("");
  const [shards, setShards] = createSignal<string[]>(["", "", ""]);

  const updateShard = (index: number, value: string) => {
    setShards((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addShard = () => setShards((prev) => [...prev, ""]);
  const removeShard = (index: number) =>
    setShards((prev) => prev.filter((_, i) => i !== index));

  const mutation = createMutation(() => ({
    mutationFn: () =>
      api.unseal(
        shards().filter((s) => s.trim()),
        threshold(),
        hash()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["version"] });
    },
  }));

  const adminTokenMutation = createMutation(() => ({
    mutationFn: () =>
      api.adminToken(
        shards().filter((s) => s.trim()),
        threshold(),
        hash()
      ),
    onSuccess: (data) => {
      localStorage.setItem("vault_token", data.token);
      queryClient.invalidateQueries({ queryKey: ["version"] });
      navigate("/secrets");
    },
  }));

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Unseal Vault</h1>

      <div class="bg-vault-surface border border-vault-border rounded-lg p-6 max-w-2xl">
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-vault-text-muted mb-1">Threshold</label>
            <input
              type="number"
              min="2"
              value={threshold()}
              onInput={(e) => setThreshold(parseInt(e.currentTarget.value) || 3)}
              class="w-32 bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
            />
          </div>

          <div>
            <label class="block text-xs text-vault-text-muted mb-1">Hash</label>
            <input
              type="text"
              value={hash()}
              onInput={(e) => setHash(e.currentTarget.value)}
              placeholder="Key hash from init..."
              class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-vault-text-muted">Unseal Keys</label>
              <button
                onClick={addShard}
                class="text-xs text-vault-accent hover:text-vault-accent-hover"
              >
                + Add key
              </button>
            </div>
            <div class="space-y-2">
              <For each={shards()}>
                {(shard, i) => (
                  <div class="flex gap-2">
                    <input
                      type="text"
                      value={shard}
                      onInput={(e) => updateShard(i(), e.currentTarget.value)}
                      placeholder={`Key ${i() + 1}...`}
                      class="flex-1 bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent"
                    />
                    <Show when={shards().length > 1}>
                      <button
                        onClick={() => removeShard(i())}
                        class="text-vault-text-muted hover:text-vault-danger text-sm px-2"
                      >
                        x
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? "Unsealing..." : "Unseal"}
          </button>
        </div>

        <Show when={mutation.isSuccess}>
          <div class="mt-4 bg-vault-success/10 border border-vault-success/30 rounded-lg p-3">
            <p class="text-vault-success text-sm">
              {mutation.data?.success ? "Vault unsealed successfully" : "Unseal failed - check keys"}
            </p>
          </div>
          <Show when={mutation.data?.success && !localStorage.getItem("vault_token")}>
            <button
              onClick={() => adminTokenMutation.mutate()}
              disabled={adminTokenMutation.isPending}
              class="mt-3 w-full bg-vault-surface border border-vault-border hover:bg-vault-surface-hover text-sm rounded px-4 py-2 transition-colors"
            >
              {adminTokenMutation.isPending ? "Generating..." : "Generate admin token & continue"}
            </button>
          </Show>
        </Show>

        <Show when={mutation.isError}>
          <p class="mt-3 text-vault-danger text-sm">{(mutation.error as Error).message}</p>
        </Show>
      </div>
    </div>
  );
}
