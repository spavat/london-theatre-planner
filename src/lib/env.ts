// Load .env when present (local dev, scraper CLI). In production the variables come from the container.
try {
  process.loadEnvFile();
} catch {}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const databasePath = process.env.DATABASE_PATH ?? "./data/app.db";
