/**
 * Seed script — populates vault with example secrets.
 * Run after init + unseal with an admin token:
 *
 *   VAULT_TOKEN=<admin_token> bun run seed.ts
 */
import { VaultClient } from "@vault/sdk";

const client = new VaultClient({
  addr: process.env.VAULT_ADDR ?? "http://localhost:5045",
  token: process.env.VAULT_TOKEN,
});

console.log("Seeding vault with example secrets...\n");

await client.put("examples/database", {
  host: "localhost",
  port: "5432",
  user: "app_user",
  password: "super_secret_password",
});
console.log("  /examples/database  (host, port, user, password)");

await client.put("examples/app", {
  secret_string: "my-application-secret-key-abc123",
});
console.log("  /examples/app       (secret_string)");

console.log("\nDone. Now create an app credential:");
console.log("  vault credential create example-app app");
console.log("\nThen set VAULT_APP_ID and VAULT_APP_SECRET in .env");
