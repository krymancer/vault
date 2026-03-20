import { Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { api } from "../api";

export default function Overview() {
  const status = createQuery(() => ({
    queryKey: ["version"],
    queryFn: api.version,
  }));

  const isOpen = () => status.data?.status === 1;

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Overview</h1>

      <Show when={status.data} fallback={<p class="text-vault-text-muted">Loading...</p>}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div class="bg-vault-surface border border-vault-border rounded-lg p-5">
            <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-2">
              Status
            </p>
            <div class="flex items-center gap-2">
              <div
                class={`w-3 h-3 rounded-full ${
                  isOpen() ? "bg-vault-success" : "bg-vault-danger"
                }`}
              />
              <span class="text-lg font-medium">
                {isOpen() ? "Unsealed" : "Sealed"}
              </span>
            </div>
          </div>

          <div class="bg-vault-surface border border-vault-border rounded-lg p-5">
            <p class="text-xs uppercase tracking-wider text-vault-text-muted mb-2">
              Auth
            </p>
            <Show
              when={localStorage.getItem("vault_token")}
              fallback={<span class="text-vault-text-muted">No token</span>}
            >
              <span class="text-vault-success text-sm">Authenticated</span>
            </Show>
          </div>
        </div>

        <Show when={!isOpen()}>
          <div class="mt-6 bg-vault-warning/10 border border-vault-warning/30 rounded-lg p-4 max-w-2xl">
            <p class="text-vault-warning text-sm">
              Vault is sealed. Initialize or unseal to begin.
            </p>
          </div>
        </Show>
      </Show>
    </div>
  );
}
