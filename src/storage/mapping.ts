import { promises as fs } from "fs";
import path from "path";
import { config } from "../config";
import type { ApplicationRecord } from "../types";

const dataDir = path.resolve(process.cwd(), "data");
const mappingPath = path.join(dataDir, "mapping.json");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readAll(): Promise<Record<string, ApplicationRecord>> {
  try {
    const raw = await fs.readFile(mappingPath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, ApplicationRecord>;
  } catch (e: any) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

async function writeAll(map: Record<string, ApplicationRecord>) {
  await ensureDataDir();
  await fs.writeFile(mappingPath, JSON.stringify(map, null, 2), "utf8");
}

export async function upsertApplication(record: ApplicationRecord) {
  const map = await readAll();
  map[record.applicationId] = record;
  await writeAll(map);
}

export async function getApplication(applicationId: string): Promise<ApplicationRecord | null> {
  const map = await readAll();
  return map[applicationId] ?? null;
}

export async function getApplicationByChannelId(discordChannelId: string): Promise<ApplicationRecord | null> {
  const map = await readAll();
  const found = Object.values(map).find((r) => r.discordChannelId === discordChannelId);
  return found ?? null;
}

export async function deleteApplication(applicationId: string) {
  const map = await readAll();
  delete map[applicationId];
  await writeAll(map);
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationRecord["status"]) {
  const map = await readAll();
  const rec = map[applicationId];
  if (!rec) return;
  rec.status = status;
  map[applicationId] = rec;
  await writeAll(map);
}

export async function ensureBaseDirectories() {
  const base = path.resolve(process.cwd(), config.APPLICATIONS_BASE_PATH);
  await fs.mkdir(base, { recursive: true });
  await ensureDataDir();
}

