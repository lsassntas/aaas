import { promises as fs } from "fs";
import path from "path";

export type AfkEntry = {
  guildId: string;
  userId: string;
  reason: string;
  untilIso: string; // inclusive
  createdAtIso: string;
};

type AfkStore = {
  entries: AfkEntry[];
};

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "afk.json");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readAll(): Promise<AfkStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) return { entries: [] };
    const parsed = JSON.parse(raw) as Partial<AfkStore>;
    return { entries: parsed.entries ?? [] };
  } catch (e: any) {
    if (e?.code === "ENOENT") return { entries: [] };
    throw e;
  }
}

async function writeAll(data: AfkStore) {
  await ensureDataDir();
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function isExpired(entry: AfkEntry, nowMs: number) {
  const untilMs = Date.parse(entry.untilIso);
  return Number.isFinite(untilMs) && untilMs <= nowMs;
}

export async function listAfk(guildId: string, nowMs = Date.now()): Promise<AfkEntry[]> {
  const data = await readAll();
  const alive = data.entries.filter((e) => e.guildId === guildId && !isExpired(e, nowMs));
  if (alive.length !== data.entries.length) {
    data.entries = data.entries.filter((e) => !isExpired(e, nowMs));
    await writeAll(data);
  }
  return alive.sort((a, b) => Date.parse(a.untilIso) - Date.parse(b.untilIso));
}

export async function isUserAfk(guildId: string, userId: string, nowMs = Date.now()): Promise<boolean> {
  const list = await listAfk(guildId, nowMs);
  return list.some((e) => e.userId === userId);
}

export async function upsertAfk(params: { guildId: string; userId: string; reason: string; minutes: number }) {
  const data = await readAll();
  const now = Date.now();
  const until = new Date(now + params.minutes * 60_000).toISOString();
  const reason = params.reason.trim().slice(0, 200);

  data.entries = data.entries.filter((e) => !(e.guildId === params.guildId && e.userId === params.userId));
  data.entries.push({
    guildId: params.guildId,
    userId: params.userId,
    reason,
    untilIso: until,
    createdAtIso: nowIso(),
  });
  await writeAll(data);
}

export async function removeAfk(guildId: string, userId: string) {
  const data = await readAll();
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => !(e.guildId === guildId && e.userId === userId));
  if (data.entries.length !== before) await writeAll(data);
}

