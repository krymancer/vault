import { resolve } from "@vault/sdk";
import postgres from "postgres";

const env = await resolve({
  addr: process.env.VAULT_ADDR ?? "http://localhost:5045",
  appId: process.env.VAULT_APP_ID,
  appSecret: process.env.VAULT_APP_SECRET,
});

console.log("Resolved configuration from vault:\n");
console.log(`  DATABASE_HOST     = ${env.DATABASE_HOST}`);
console.log(`  DATABASE_PORT     = ${env.DATABASE_PORT}`);
console.log(`  DATABASE_USER     = ${env.DATABASE_USER}`);
console.log(`  DATABASE_PASSWORD = ${"*".repeat(env.DATABASE_PASSWORD.length)}`);
console.log(`  DATABASE_NAME     = ${env.DATABASE_NAME}`);
console.log(`  SECRET_STRING     = ${env.SECRET_STRING}`);

const sql = postgres({
  host: env.DATABASE_HOST,
  port: Number(env.DATABASE_PORT),
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
});

const [row] = await sql`SELECT current_database() AS db, current_user AS "user", version()`;
console.log(`  Connected to "${row.db}" as "${row.user}"`);
console.log(`  ${row.version}\n`);

const tables = await sql`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`;
console.log(`  Public tables: ${tables.map((t) => t.tablename).join(", ")}`);

await sql.end();
