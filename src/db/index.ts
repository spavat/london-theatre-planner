import { databasePath } from "@/lib/env";
import { openDb } from "./client";

export const db = openDb(databasePath);
