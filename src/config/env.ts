import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: optionalSecret.pipe(z.string().min(32).optional()),
  ENCRYPTION_KEY: optionalSecret,
  REDIS_URL: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated server environment. Throws a readable error naming bad keys (never values). */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    const hint = keys.includes("DATABASE_URL")
      ? " — start the app with `npm run dev` (it sets up a local database automatically) or set DATABASE_URL in .env"
      : "";
    throw new Error(`Invalid environment configuration: ${keys}${hint}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";
