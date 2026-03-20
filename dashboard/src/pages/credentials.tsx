import { createSignal, Show, For } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { api, type CreateCredentialResponse } from "../api";

export default function Credentials() {
  const queryClient = useQueryClient();
  const [name, setName] = createSignal("");
  const [kind, setKind] = createSignal("app");
  const [created, setCreated] = createSignal<CreateCredentialResponse | null>(null);

  const credentials = createQuery(() => ({
    queryKey: ["credentials"],
    queryFn: api.listCredentials,
  }));

  const createCred = createMutation(() => ({
    mutationFn: () => api.createCredential(name(), kind()),
    onSuccess: (data) => {
      setCreated(data);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
  }));

  const deleteCred = createMutation(() => ({
    mutationFn: (id: string) => api.deleteCredential(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credentials"] }),
  }));

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Credentials</h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-4">Create Credential</p>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-vault-text-muted mb-1">Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="my-app or user@email..."
                class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
              />
            </div>
            <div>
              <label class="block text-xs text-vault-text-muted mb-1">Kind</label>
              <select
                value={kind()}
                onChange={(e) => setKind(e.currentTarget.value)}
                class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
              >
                <option value="app">App</option>
                <option value="user">User</option>
              </select>
            </div>
            <button
              onClick={() => { setCreated(null); createCred.mutate(); }}
              disabled={createCred.isPending || !name().trim()}
              class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {createCred.isPending ? "Creating..." : "Create"}
            </button>
          </div>

          <Show when={created()}>
            {(cred) => (
              <div class="mt-4 space-y-2">
                <div class="bg-vault-warning/10 border border-vault-warning/30 rounded-lg p-3">
                  <p class="text-vault-warning text-xs mb-2">Save these now. The secret cannot be retrieved later.</p>
                </div>
                <div>
                  <p class="text-xs text-vault-text-muted">ID</p>
                  <code class="text-xs break-all bg-vault-bg p-2 rounded block">{cred().id}</code>
                </div>
                <div>
                  <p class="text-xs text-vault-text-muted">Secret</p>
                  <code class="text-xs break-all bg-vault-bg p-2 rounded block">{cred().secret}</code>
                </div>
              </div>
            )}
          </Show>

          <Show when={createCred.isError}>
            <p class="mt-3 text-vault-danger text-sm">{(createCred.error as Error).message}</p>
          </Show>
        </div>

        <div class="bg-vault-surface border border-vault-border rounded-lg p-6">
          <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-4">Credentials</p>

          <Show
            when={credentials.data?.credentials?.length}
            fallback={<p class="text-sm text-vault-text-muted">No credentials</p>}
          >
            <div class="space-y-2">
              <For each={credentials.data?.credentials}>
                {(cred) => (
                  <div class="flex items-center justify-between bg-vault-bg rounded p-3">
                    <div>
                      <p class="text-sm font-medium">{cred.name}</p>
                      <p class="text-xs text-vault-text-muted">
                        {cred.kind} &middot; {cred.id.slice(0, 8)}...
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCred.mutate(cred.id)}
                      class="text-xs text-vault-danger hover:text-vault-danger/80 transition-colors"
                    >
                      Delete
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
