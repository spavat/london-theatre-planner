// Production startup, loaded with `node --import ./dist/boot.mjs dist/server/entry.mjs`:
// applies pending migrations before the server accepts requests, then starts the scrape scheduler.
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/db";
import { startScheduler } from "@/scraper/scheduler";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Database migrations applied");
startScheduler(db);
