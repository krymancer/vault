import { createSignal, Show, For, onCleanup, createEffect } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { useNavigate } from "@solidjs/router";
import { api } from "../api";

export default function SearchModal() {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  const search = createQuery(() => ({
    queryKey: ["search", query()],
    queryFn: () => api.search(query()),
    enabled: query().length >= 1 && open(),
  }));

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      setOpen(!open());
      if (!open()) setQuery("");
    }
    if (e.key === "Escape" && open()) {
      setOpen(false);
      setQuery("");
    }
  };

  createEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  createEffect(() => {
    if (open()) setTimeout(() => inputRef?.focus(), 0);
  });

  const goTo = (path: string) => {
    const trimmed = path.startsWith("/") ? path.slice(1) : path;
    navigate(`/secrets`);
    setOpen(false);
    setQuery("");
  };

  return (
    <Show when={open()}>
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[20vh]"
        onClick={() => { setOpen(false); setQuery(""); }}
      >
        <div
          class="bg-vault-surface border border-vault-border rounded-lg shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="p-3 border-b border-vault-border">
            <input
              ref={inputRef}
              type="text"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search secrets and paths..."
              class="w-full bg-transparent text-sm focus:outline-none placeholder:text-vault-text-muted"
            />
          </div>

          <div class="max-h-80 overflow-y-auto">
            <Show when={search.data && (search.data.paths.length > 0 || search.data.secrets.length > 0)}>
              <Show when={search.data!.paths.length > 0}>
                <div class="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-vault-text-muted">
                  Paths
                </div>
                <For each={search.data!.paths}>
                  {(p) => (
                    <button
                      onClick={() => goTo(p.path)}
                      class="w-full text-left px-3 py-2 hover:bg-vault-surface-hover transition-colors flex items-center justify-between"
                    >
                      <span class="text-sm font-mono">{p.path}</span>
                      <span class="text-xs text-vault-text-muted">
                        {p.secretCount} secrets, {p.childCount} children
                      </span>
                    </button>
                  )}
                </For>
              </Show>

              <Show when={search.data!.secrets.length > 0}>
                <div class="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-vault-text-muted">
                  Secrets
                </div>
                <For each={search.data!.secrets}>
                  {(s) => (
                    <button
                      onClick={() => goTo(s.path)}
                      class="w-full text-left px-3 py-2 hover:bg-vault-surface-hover transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span class="text-sm font-mono">{s.path}/</span>
                        <span class="text-sm font-mono text-vault-accent">{s.key}</span>
                      </div>
                      <span class="text-xs text-vault-text-muted">v{s.version}</span>
                    </button>
                  )}
                </For>
              </Show>
            </Show>

            <Show when={query().length >= 1 && search.isSuccess && !search.data?.paths.length && !search.data?.secrets.length}>
              <div class="px-3 py-6 text-center text-vault-text-muted text-sm">
                No results for "{query()}"
              </div>
            </Show>

            <Show when={!query()}>
              <div class="px-3 py-6 text-center text-vault-text-muted text-sm">
                Type to search...
              </div>
            </Show>
          </div>

          <div class="p-2 border-t border-vault-border text-[10px] text-vault-text-muted text-center">
            Ctrl+P to toggle &middot; Esc to close
          </div>
        </div>
      </div>
    </Show>
  );
}
