/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import App from "./app";
import Overview from "./pages/overview";
import Init from "./pages/init";
import Secrets from "./pages/secrets";
import Auth from "./pages/auth";
import Credentials from "./pages/credentials";
import Tokens from "./pages/tokens";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <Router root={App}>
        <Route path="/" component={Overview} />
        <Route path="/init" component={Init} />
        <Route path="/unseal" component={Init} />
        <Route path="/secrets" component={Secrets} />
        <Route path="/secrets/*rest" component={Secrets} />
        <Route path="/auth" component={Auth} />
        <Route path="/credentials" component={Credentials} />
        <Route path="/tokens" component={Tokens} />
      </Router>
    </QueryClientProvider>
  ),
  document.getElementById("root")!
);
