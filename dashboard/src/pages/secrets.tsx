import { createSignal, Show } from "solid-js";
import { createMutation } from "@tanstack/solid-query";
import { api } from "../api";

export default function Secrets() {
  const [mode, setMode] = createSignal<"encrypt" | "decrypt">("encrypt");
  const [input, setInput] = createSignal("");
  const [output, setOutput] = createSignal("");

  const encrypt = createMutation(() => ({
    mutationFn: () => api.encrypt(input()),
    onSuccess: (data) => setOutput(data.ciphertext),
  }));

  const decrypt = createMutation(() => ({
    mutationFn: () => api.decrypt(input()),
    onSuccess: (data) => setOutput(data.plaintext),
  }));

  const pending = () => encrypt.isPending || decrypt.isPending;

  const handleSubmit = () => {
    setOutput("");
    if (mode() === "encrypt") encrypt.mutate();
    else decrypt.mutate();
  };

  const error = () => encrypt.error || decrypt.error;

  return (
    <div>
      <h1 class="text-xl font-semibold mb-6">Secrets</h1>

      <div class="bg-vault-surface border border-vault-border rounded-lg p-6 max-w-2xl">
        <div class="flex gap-2 mb-4">
          <button
            onClick={() => { setMode("encrypt"); setOutput(""); }}
            class={`px-3 py-1.5 text-sm rounded transition-colors ${
              mode() === "encrypt"
                ? "bg-vault-accent text-white"
                : "text-vault-text-muted hover:text-vault-text"
            }`}
          >
            Encrypt
          </button>
          <button
            onClick={() => { setMode("decrypt"); setOutput(""); }}
            class={`px-3 py-1.5 text-sm rounded transition-colors ${
              mode() === "decrypt"
                ? "bg-vault-accent text-white"
                : "text-vault-text-muted hover:text-vault-text"
            }`}
          >
            Decrypt
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-vault-text-muted mb-1">
              {mode() === "encrypt" ? "Plaintext" : "Ciphertext"}
            </label>
            <textarea
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder={mode() === "encrypt" ? "Enter text to encrypt..." : "Enter ciphertext to decrypt..."}
              rows={4}
              class="w-full bg-vault-bg border border-vault-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-vault-accent resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending() || !input().trim()}
            class="w-full bg-vault-accent hover:bg-vault-accent-hover text-white rounded px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            {pending() ? "Processing..." : mode() === "encrypt" ? "Encrypt" : "Decrypt"}
          </button>
        </div>

        <Show when={output()}>
          <div class="mt-4">
            <label class="block text-xs text-vault-text-muted mb-1">
              {mode() === "encrypt" ? "Ciphertext" : "Plaintext"}
            </label>
            <code class="text-xs break-all bg-vault-bg p-3 rounded block font-mono">
              {output()}
            </code>
          </div>
        </Show>

        <Show when={error()}>
          <p class="mt-3 text-vault-danger text-sm">{(error() as Error).message}</p>
        </Show>
      </div>
    </div>
  );
}
