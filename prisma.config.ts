import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` must work without a database (CI, postinstall), so the URL
// falls back to a placeholder; migrate/introspect commands need a real one.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
