import { createSignal, Show, For, Match, Switch } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { useParams, useNavigate } from "@solidjs/router";
import { api, type KvListItem } from "../api";

export default function Secrets() {
  const params = useParams<{ rest?: string }>();
  const navigate = useNavigate();

  const currentPath = () => params.rest?.replace(/^\//, "") || "";
  const isRoot = () => !currentPath();

  const browse = createQuery(() => ({
    queryKey: ["kv-browse", currentPath()],
    queryFn: () => api.kvBrowse(currentPath() || undefined),
    retry: false,
  }));

  const breadcrumbs = () => {
    const parts = currentPath().split("/").filter(Boolean);
    return [
      { name: "secrets", path: "" },
      ...parts.map((p, i) => ({
        name: p,
        path: parts.slice(0, i + 1).join("/"),
      })),
    ];
  };

  const goTo = (path: string) => {
    navigate(path ? `/secrets/${path}` : "/secrets");
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">Secrets</h1>
        <CreateSecretButton path={currentPath()} isRoot={isRoot()} />
      </div>

      {/* Breadcrumbs */}
      <div class="flex items-center gap-1 mb-4 text-sm">
        <For each={breadcrumbs()}>
          {(crumb, i) => (
            <>
              {i() > 0 && <span class="text-vault-text-muted">/</span>}
              <button
                onClick={() => goTo(crumb.path)}
                class={`hover:text-vault-accent transition-colors ${
                  i() === breadcrumbs().length - 1
                    ? "text-vault-text font-medium"
                    : "text-vault-text-muted"
                }`}
              >
                {crumb.name}
              </button>
            </>
          )}
        </For>
      </div>

      {/* Directory listing */}
      <Show when={browse.isSuccess && browse.data?.kind === "directory"}>
        <DirectoryView
          items={(browse.data as any).data.items ?? []}
          onNavigate={goTo}
          path={currentPath()}
        />
      </Show>

      {/* Secret detail (leaf) */}
      <Show when={browse.isSuccess && browse.data?.kind === "leaf"}>
        <SecretDetail
          path={currentPath()}
          secrets={(browse.data as any).data.secrets ?? {}}
        />
      </Show>

      {/* Loading */}
      <Show when={browse.isLoading}>
        <div class="text-vault-text-muted text-sm">Loading...</div>
      </Show>

      {/* Auth error */}
      <Show when={browse.isError && (browse.error as Error).message === "Unauthorized"}>
        <div class="bg-vault-surface border border-vault-border rounded-lg px-4 py-8 text-center text-vault-text-muted text-sm max-w-2xl">
          Set a token to view secrets
        </div>
      </Show>

      {/* 404 */}
      <Show when={browse.isError && (browse.error as Error).message !== "Unauthorized"}>
        <div class="bg-vault-surface border border-vault-border rounded-lg px-4 py-8 text-center text-vault-text-muted text-sm max-w-2xl">
          Path not found
        </div>
      </Show>
    </div>
  );
}

// --- Directory View ---

function DirectoryView(props: {
  items: KvListItem[];
  onNavigate: (path: string) => void;
  path: string;
}) {
  return (
    <div class="bg-vault-surface border border-vault-border rounded-lg max-w-2xl overflow-hidden">
      <Show
        when={props.items.length > 0}
        fallback={
          <div class="px-4 py-8 text-center text-vault-text-muted text-sm">
            No secrets or paths here yet.
          </div>
        }
      >
        <For each={props.items}>
          {(item) => (
            <button
              onClick={() => props.onNavigate(item.fullPath.slice(1))}
              class="w-full flex items-center justify-between px-4 py-3 border-b border-vault-border last:border-b-0 hover:bg-vault-surface-hover transition-colors text-left group"
            >
              <div class="flex items-center gap-3">
                <span class="text-vault-text-muted text-xs w-4">
                  {item.type === "directory" ? ">" : "*"}
                </span>
                <span class="text-sm group-hover:text-vault-accent transition-colors">
                  {item.name}{item.type === "directory" ? "/" : ""}
                </span>
              </div>
              <span class="text-xs text-vault-text-muted">
                {item.type === "directory"
                  ? `${item.childCount} path${item.childCount !== 1 ? "s" : ""}`
                  : `${item.secretCount} secret${item.secretCount !== 1 ? "s" : ""}`}
              </span>
            </button>
          )}
        </For>
      </Show>
    </div>
  );
}

// --- Secret Detail (table + json views) ---

function SecretDetail(props: { path: string; secrets: Record<string, string> }) {
  const queryClient = useQueryClient();
  const [view, setView] = createSignal<"table" | "json">("table");
  const [jsonText, setJsonText] = createSignal("");
  const [jsonError, setJsonError] = createSignal("");

  // Sync json text when secrets change
  const initJson = () => JSON.stringify(props.secrets, null, 2);

  const switchToJson = () => {
    setJsonText(initJson());
    setJsonError("");
    setView("json");
  };

  const saveMutation = createMutation(() => ({
    mutationFn: (secrets: Record<string, string>) =>
      api.kvPut(props.path, secrets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kv-browse"] });
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (key: string) => api.kvDelete(props.path, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kv-browse"] });
    },
  }));

  const saveJson = () => {
    try {
      const parsed = JSON.parse(jsonText());
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("Must be a JSON object");
        return;
      }
      // Validate all values are strings
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== "string") {
          setJsonError(`Value for "${k}" must be a string`);
          return;
        }
      }
      setJsonError("");

      const newSecrets = parsed as Record<string, string>;
      const oldKeys = Object.keys(props.secrets);
      const newKeys = Object.keys(newSecrets);

      // Delete removed keys
      const removed = oldKeys.filter((k) => !newKeys.includes(k));
      for (const key of removed) {
        deleteMutation.mutate(key);
      }

      // Upsert changed/new keys
      const changed: Record<string, string> = {};
      for (const [k, v] of Object.entries(newSecrets)) {
        if (props.secrets[k] !== v) {
          changed[k] = v;
        }
      }
      if (Object.keys(changed).length > 0) {
        saveMutation.mutate(changed);
      }

      setView("table");
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div class="max-w-2xl">
      {/* View toggle */}
      <div class="flex items-center gap-2 mb-3">
        <button
          onClick={() => setView("table")}
          class={`px-3 py-1.5 text-xs rounded transition-colors ${
            view() === "table"
              ? "bg-vault-accent text-white"
              : "text-vault-text-muted hover:text-vault-text"
          }`}
        >
          Table
        </button>
        <button
          onClick={switchToJson}
          class={`px-3 py-1.5 text-xs rounded transition-colors ${
            view() === "json"
              ? "bg-vault-accent text-white"
              : "text-vault-text-muted hover:text-vault-text"
          }`}
        >
          JSON
        </button>
      </div>

      <Switch>
        <Match when={view() === "table"}>
          <TableView
            secrets={props.secrets}
            path={props.path}
            onDelete={(key) => deleteMutation.mutate(key)}
            onSave={(key, value) => saveMutation.mutate({ [key]: value })}
          />
        </Match>
        <Match when={view() === "json"}>
          <div class="bg-vault-surface border border-vault-border rounded-lg p-4">
            <textarea
              value={jsonText()}
              onInput={(e) => setJsonText(e.currentTarget.value)}
              rows={Math.max(8, jsonText().split("\n").length + 2)}
              class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent resize-y"
              spellcheck={false}
            />
            <Show when={jsonError()}>
              <p class="text-vault-danger text-xs mt-2">{jsonError()}</p>
            </Show>
            <div class="flex gap-2 mt-3">
              <button
                onClick={saveJson}
                disabled={saveMutation.isPending}
                class="bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setView("table")}
                class="text-vault-text-muted hover:text-vault-text text-sm px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

// --- Table View ---

function TableView(props: {
  secrets: Record<string, string>;
  path: string;
  onDelete: (key: string) => void;
  onSave: (key: string, value: string) => void;
}) {
  const [addKey, setAddKey] = createSignal("");
  const [addValue, setAddValue] = createSignal("");
  const [showAdd, setShowAdd] = createSignal(false);

  const handleAdd = () => {
    if (addKey().trim() && addValue().trim()) {
      props.onSave(addKey(), addValue());
      setAddKey("");
      setAddValue("");
      setShowAdd(false);
    }
  };

  return (
    <div class="bg-vault-surface border border-vault-border rounded-lg overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 bg-vault-bg border-b border-vault-border">
        <span class="text-xs text-vault-text-muted uppercase tracking-wider">
          {Object.keys(props.secrets).length} secret{Object.keys(props.secrets).length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setShowAdd(!showAdd())}
          class="text-xs text-vault-accent hover:text-vault-accent-hover transition-colors"
        >
          {showAdd() ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add row */}
      <Show when={showAdd()}>
        <div class="flex items-center gap-2 px-4 py-3 border-b border-vault-border bg-vault-accent/5">
          <input
            type="text"
            value={addKey()}
            onInput={(e) => setAddKey(e.currentTarget.value)}
            placeholder="key"
            class="flex-1 bg-vault-bg border border-vault-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vault-accent"
          />
          <input
            type="text"
            value={addValue()}
            onInput={(e) => setAddValue(e.currentTarget.value)}
            placeholder="value"
            class="flex-[2] bg-vault-bg border border-vault-border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-vault-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!addKey().trim() || !addValue().trim()}
            class="bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </Show>

      {/* Rows */}
      <Show
        when={Object.keys(props.secrets).length > 0}
        fallback={
          <div class="px-4 py-8 text-center text-vault-text-muted text-sm">
            No secrets. Click + Add to create one.
          </div>
        }
      >
        <For each={Object.entries(props.secrets)}>
          {([key, value]) => (
            <SecretRow
              key={key}
              value={value}
              onSave={(v) => props.onSave(key, v)}
              onDelete={() => props.onDelete(key)}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

// --- Single Secret Row ---

function SecretRow(props: {
  key: string;
  value: string;
  onSave: (value: string) => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");

  const startEdit = () => {
    setEditValue(props.value);
    setEditing(true);
  };

  const saveEdit = () => {
    if (editValue() !== props.value) {
      props.onSave(editValue());
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <div class="flex items-center gap-3 px-4 py-3 border-b border-vault-border last:border-b-0 group">
      <label class="text-sm font-medium w-36 shrink-0 truncate" title={props.key}>
        {props.key}
      </label>

      <div class="flex-1 min-w-0">
        <Switch>
          <Match when={editing()}>
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                class="flex-1 bg-vault-bg border border-vault-accent rounded px-2 py-1 text-sm font-mono focus:outline-none"
                autofocus
              />
              <button onClick={saveEdit} class="text-xs text-vault-success">Save</button>
              <button onClick={cancelEdit} class="text-xs text-vault-text-muted">Esc</button>
            </div>
          </Match>
          <Match when={!editing()}>
            <span class="text-sm font-mono text-vault-text-muted truncate block">
              {revealed() ? props.value : "\u2022".repeat(Math.min(props.value.length, 24))}
            </span>
          </Match>
        </Switch>
      </div>

      <Show when={!editing()}>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setRevealed(!revealed())}
            class="text-[11px] text-vault-text-muted hover:text-vault-text px-1.5 py-0.5 rounded hover:bg-vault-bg transition-colors"
            title={revealed() ? "Hide" : "Reveal"}
          >
            {revealed() ? "Hide" : "View"}
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(props.value)}
            class="text-[11px] text-vault-text-muted hover:text-vault-text px-1.5 py-0.5 rounded hover:bg-vault-bg transition-colors"
            title="Copy"
          >
            Copy
          </button>
          <button
            onClick={startEdit}
            class="text-[11px] text-vault-text-muted hover:text-vault-text px-1.5 py-0.5 rounded hover:bg-vault-bg transition-colors"
            title="Edit"
          >
            Edit
          </button>
          <button
            onClick={props.onDelete}
            class="text-[11px] text-vault-danger hover:text-vault-danger/80 px-1.5 py-0.5 rounded hover:bg-vault-bg transition-colors"
            title="Delete"
          >
            Del
          </button>
        </div>
      </Show>
    </div>
  );
}

// --- Create Secret Button ---

function CreateSecretButton(props: { path: string; isRoot: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = createSignal(false);
  const [pathInput, setPathInput] = createSignal("");
  const [key, setKey] = createSignal("");
  const [value, setValue] = createSignal("");

  const targetPath = () => {
    const sub = pathInput().trim().replace(/^\/+/, "");
    if (props.isRoot) return sub;
    return sub ? props.path + "/" + sub : props.path;
  };

  const canSubmit = () => {
    if (!key().trim() || !value().trim()) return false;
    if (props.isRoot && !pathInput().trim()) return false;
    return true;
  };

  const mutation = createMutation(() => ({
    mutationFn: () => api.kvPut(targetPath(), { [key()]: value() }),
    onSuccess: () => {
      setOpen(false);
      setPathInput("");
      setKey("");
      setValue("");
      queryClient.invalidateQueries({ queryKey: ["kv-browse"] });
    },
  }));

  return (
    <>
      <button
        onClick={() => setOpen(!open())}
        class="bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-3 py-1.5 text-sm transition-colors"
      >
        {open() ? "Cancel" : "+ Add Secret"}
      </button>
      <Show when={open()}>
        <div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div class="bg-vault-surface border border-vault-border rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p class="text-sm font-medium mb-4">New Secret</p>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-vault-text-muted mb-1">
                  {props.isRoot ? "Path (required)" : "Subpath (optional)"}
                </label>
                <input
                  type="text"
                  value={pathInput()}
                  onInput={(e) => setPathInput(e.currentTarget.value)}
                  placeholder={props.isRoot ? "e.g. production/database" : "e.g. subpath (leave empty for current)"}
                  class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
                />
                <Show when={targetPath()}>
                  <p class="text-[11px] text-vault-text-muted mt-1">
                    Will write to: /{targetPath()}
                  </p>
                </Show>
              </div>
              <div>
                <label class="block text-xs text-vault-text-muted mb-1">Key</label>
                <input
                  type="text"
                  value={key()}
                  onInput={(e) => setKey(e.currentTarget.value)}
                  placeholder="api-key"
                  class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm focus:outline-none focus:border-vault-accent"
                />
              </div>
              <div>
                <label class="block text-xs text-vault-text-muted mb-1">Value</label>
                <input
                  type="text"
                  value={value()}
                  onInput={(e) => setValue(e.currentTarget.value)}
                  placeholder="sk-live-..."
                  class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent"
                />
              </div>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !canSubmit()}
                class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? "Saving..." : "Save Secret"}
              </button>
              <Show when={mutation.isError}>
                <p class="text-vault-danger text-xs">{(mutation.error as Error).message}</p>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
