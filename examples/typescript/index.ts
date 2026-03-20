import { resolve } from "@vault/sdk";

// Resolve all vault:path#key references in env vars
const env = await resolve({
  addr: process.env.VAULT_ADDR ?? "http://localhost:5045",
  appId: process.env.VAULT_APP_ID,
  appSecret: process.env.VAULT_APP_SECRET,
});

// Now use secrets as regular env vars
console.log("Resolved configuration:\n");
console.log(`  DATABASE_HOST     = ${env.DATABASE_HOST}`);
console.log(`  DATABASE_PORT     = ${env.DATABASE_PORT}`);
console.log(`  DATABASE_USER     = ${env.DATABASE_USER}`);
console.log(`  DATABASE_PASSWORD = ${env.DATABASE_PASSWORD}`);
console.log(`  SECRET_STRING     = ${env.SECRET_STRING}`);

// Example: build a connection string from resolved secrets
const connStr = `postgres://${env.DATABASE_USER}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}:${env.DATABASE_PORT}/mydb`;
console.log(`\n  Connection string: ${connStr}`);
