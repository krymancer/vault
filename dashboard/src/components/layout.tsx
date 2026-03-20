import { type ParentProps, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";

function NavLink(props: { href: string; label: string; icon: string }) {
  const location = useLocation();
  const isActive = () => location.pathname === props.href;

  return (
    <A
      href={props.href}
      class={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
        isActive()
          ? "bg-vault-accent/15 text-vault-accent"
          : "text-vault-text-muted hover:text-vault-text hover:bg-vault-surface-hover"
      }`}
    >
      <span class="text-base">{props.icon}</span>
      {props.label}
    </A>
  );
}

export default function Layout(props: ParentProps<{ isOpen: boolean }>) {
  const token = () => localStorage.getItem("vault_token");

  return (
    <div class="flex h-screen">
      <aside class="w-56 bg-vault-surface border-r border-vault-border flex flex-col">
        <div class="p-4 border-b border-vault-border">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-vault-accent rounded flex items-center justify-center text-white text-xs font-bold">
              V
            </div>
            <span class="font-semibold text-sm">Vault</span>
          </div>
          <div class="mt-2 flex items-center gap-1.5">
            <div
              class={`w-2 h-2 rounded-full ${
                props.isOpen ? "bg-vault-success" : "bg-vault-danger"
              }`}
            />
            <span class="text-xs text-vault-text-muted">
              {props.isOpen ? "Unsealed" : "Sealed"}
            </span>
          </div>
        </div>

        <nav class="flex-1 p-3 space-y-1">
          <NavLink href="/" icon="~" label="Overview" />

          <div class="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-vault-text-muted">
            Operations
          </div>
          <NavLink href="/init" icon=">" label="Init & Unseal" />
          <NavLink href="/secrets" icon="*" label="Secrets" />

          <div class="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-vault-text-muted">
            Access
          </div>
          <NavLink href="/auth" icon="@" label="Auth" />
          <NavLink href="/credentials" icon="+" label="Credentials" />
          <NavLink href="/tokens" icon="%" label="Tokens" />
        </nav>

        <div class="p-3 border-t border-vault-border">
          <Show
            when={token()}
            fallback={
              <span class="text-xs text-vault-text-muted">No token set</span>
            }
          >
            <span class="text-xs text-vault-text-muted">
              Token: {token()!.slice(0, 8)}...
            </span>
          </Show>
          <div class="mt-1 text-[10px] text-vault-text-muted">
            Ctrl+P search | g+o overview | g+s secrets
          </div>
        </div>
      </aside>

      <main class="flex-1 overflow-auto p-8">{props.children}</main>
    </div>
  );
}
