import { createSignal, Show, For } from "solid-js";
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@solidjs/router";
import { api, type InitResponse } from "../api";

export default function Init() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const status = createQuery(() => ({
    queryKey: ["version"],
    queryFn: api.version,
  }));

  const isOpen = () => status.data?.status === 1;

  // --- Init ---
  const [count, setCount] = createSignal(5);
  const [threshold, setThreshold] = createSignal(3);
  const [result, setResult] = createSignal<InitResponse | null>(null);
  const [showConfirm, setShowConfirm] = createSignal(false);

  const initMutation = createMutation(() => ({
    mutationFn: () => api.init(count(), threshold()),
    onSuccess: (data) => {
      setResult(data);
      localStorage.setItem("vault_token", data.rootToken);
      queryClient.invalidateQueries({ queryKey: ["version"] });
    },
  }));

  const handleInit = () => {
    if (isOpen()) {
      setShowConfirm(true);
    } else {
      initMutation.mutate();
    }
  };

  const confirmInit = () => {
    setShowConfirm(false);
    initMutation.mutate();
  };

  // --- Unseal ---
  const [hash, setHash] = createSignal("");
  const [shards, setShards] = createSignal<string[]>(["", "", ""]);

  const updateShard = (index: number, value: string) => {
    setShards((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addShard = () => setShards((prev) => [...prev, ""]);
  const removeShard = (index: number) =>
    setShards((prev) => prev.filter((_, i) => i !== index));

  const unsealMutation = createMutation(() => ({
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

  // Auto-fill unseal fields from init result
  const fillFromInit = () => {
    if (!result()) return;
    setHash(result()!.hash);
    setShards(result()!.shards.slice(0, threshold()));
  };

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Initialize & Unseal</h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Init Panel */}
        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-4">Initialize</p>

          <Show when={!result()}>
            <div class="space-y-4">
              <p class="text-sm text-vault-text-muted">
                Generate master key shards using Shamir's Secret Sharing.
              </p>
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
                onClick={handleInit}
                disabled={initMutation.isPending}
                class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
              >
                {initMutation.isPending ? "Initializing..." : "Initialize"}
              </button>
              <Show when={initMutation.isError}>
                <p class="text-vault-danger text-sm">{(initMutation.error as Error).message}</p>
              </Show>
            </div>
          </Show>

          <Show when={result()}>
            {(res) => (
              <div class="space-y-3">
                <div class="bg-vault-success/10 border border-vault-success/30 rounded p-3">
                  <p class="text-vault-success text-sm">Vault initialized</p>
                </div>

                <div>
                  <p class="text-xs text-vault-text-muted mb-1">Root Token</p>
                  <code class="text-xs break-all bg-vault-bg p-2 rounded block">{res().rootToken}</code>
                </div>

                <div>
                  <p class="text-xs text-vault-text-muted mb-1">Hash</p>
                  <code class="text-xs break-all bg-vault-bg p-2 rounded block">{res().hash}</code>
                </div>

                <div>
                  <p class="text-xs text-vault-text-muted mb-1">Unseal Keys</p>
                  <div class="space-y-1">
                    <For each={res().shards}>
                      {(shard, i) => (
                        <div class="flex items-center gap-2">
                          <span class="text-vault-text-muted text-xs w-4">{i() + 1}</span>
                          <code class="text-[11px] break-all bg-vault-bg p-1.5 rounded flex-1">{shard}</code>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                <div class="bg-vault-warning/10 border border-vault-warning/30 rounded p-3">
                  <p class="text-vault-warning text-xs">
                    Save these keys securely. You need {threshold()} of {count()} to unseal.
                  </p>
                </div>

                <button
                  onClick={() => { fillFromInit(); }}
                  class="w-full bg-vault-surface border border-vault-border hover:bg-vault-surface-hover rounded px-4 py-2 text-sm transition-colors"
                >
                  Quick unseal with these keys →
                </button>
              </div>
            )}
          </Show>
        </div>

        {/* Unseal Panel */}
        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <p class="text-xs uppercase tracking-wider text-vault-text-muted">Unseal</p>
            <Show when={isOpen()}>
              <span class="text-xs text-vault-success">Already unsealed</span>
            </Show>
          </div>

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
                <button onClick={addShard} class="text-xs text-vault-accent hover:text-vault-accent-hover">
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
              onClick={() => unsealMutation.mutate()}
              disabled={unsealMutation.isPending || isOpen()}
              class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {unsealMutation.isPending ? "Unsealing..." : "Unseal"}
            </button>

            <Show when={unsealMutation.isSuccess}>
              <div class="bg-vault-success/10 border border-vault-success/30 rounded p-3">
                <p class="text-vault-success text-sm">
                  {unsealMutation.data?.success ? "Vault unsealed" : "Unseal failed - check keys"}
                </p>
              </div>
              <Show when={unsealMutation.data?.success && !localStorage.getItem("vault_token")}>
                <button
                  onClick={() => adminTokenMutation.mutate()}
                  disabled={adminTokenMutation.isPending}
                  class="w-full bg-vault-surface border border-vault-border hover:bg-vault-surface-hover rounded px-4 py-2 text-sm transition-colors"
                >
                  {adminTokenMutation.isPending ? "Generating..." : "Generate admin token & continue →"}
                </button>
              </Show>
            </Show>

            <Show when={unsealMutation.isError}>
              <p class="text-vault-danger text-sm">{(unsealMutation.error as Error).message}</p>
            </Show>
          </div>
        </div>
      </div>

      {/* Re-init confirmation dialog */}
      <Show when={showConfirm()}>
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowConfirm(false)}>
          <div class="bg-vault-surface border border-vault-border rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <p class="text-sm font-medium mb-3 text-vault-danger">Re-initialize Vault?</p>
            <p class="text-sm text-vault-text-muted mb-4">
              This will generate a new master key. All existing secrets encrypted with the current key will become
              permanently inaccessible. Tokens and credentials will also be wiped.
            </p>
            <p class="text-sm text-vault-text-muted mb-4">
              This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                class="flex-1 bg-vault-bg border border-vault-border hover:bg-vault-surface-hover rounded px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmInit}
                class="flex-1 bg-vault-danger hover:bg-vault-danger/80 text-white rounded px-4 py-2 text-sm transition-colors"
              >
                Re-initialize
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
