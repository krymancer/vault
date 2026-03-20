import { type ParentProps, createEffect, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { api } from "./api";
import Layout from "./components/layout";

export default function App(props: ParentProps) {
  const navigate = useNavigate();
  const status = createQuery(() => ({
    queryKey: ["version"],
    queryFn: api.version,
    refetchInterval: 5000,
  }));

  // Global keyboard shortcuts
  createEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "g") {
        const next = (e2: KeyboardEvent) => {
          window.removeEventListener("keydown", next);
          switch (e2.key) {
            case "o": navigate("/"); break;
            case "s": navigate("/secrets"); break;
            case "c": navigate("/credentials"); break;
            case "t": navigate("/tokens"); break;
            case "i": navigate("/init"); break;
            case "u": navigate("/unseal"); break;
            case "a": navigate("/auth"); break;
          }
        };
        window.addEventListener("keydown", next, { once: true });
        setTimeout(() => window.removeEventListener("keydown", next), 1000);
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  const isOpen = () => status.data?.status === 1;

  return (
    <Layout isOpen={isOpen()}>
      {props.children}
    </Layout>
  );
}
