import { promises as fs } from "fs";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "rp-rosters.json");

const rosterLock = new Map<string, Promise<void>>();

export async function withRpRosterLock<T>(messageId: string, fn: () => Promise<T>): Promise<T> {
  const prev = rosterLock.get(messageId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => (release = res));
  rosterLock.set(messageId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (rosterLock.get(messageId)) rosterLock.delete(messageId);
  }
}

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export type RosterKind = "postavka" | "vzh" | "poezd";

export type RosterRecord = {
  messageId: string;
  channelId: string;
  guildId: string;
  kind: RosterKind;
  /** только для постаnки — число слота 20–27 */
  postavkaNomer?: number;
  mainMax: number;
  /** null — без лимита замен */
  subMax: number | null;
  mainUserIds: string[];
  subUserIds: string[];
  /** только ВЗХ: слоты РК (обычно 2) */
  rkUserIds: string[];
  /** null — нет списка РК (поставка) */
  rkMax: number | null;
  open: boolean;
};

async function readAll(): Promise<Record<string, RosterRecord>> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, RosterRecord>;
  } catch (e: any) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

async function writeAll(map: Record<string, RosterRecord>) {
  await ensureDir();
  await fs.writeFile(storePath, JSON.stringify(map, null, 2), "utf8");
}

function normalizeRoster(raw: RosterRecord): RosterRecord {
  const rkUserIds = raw.rkUserIds ?? [];
  const rkMax =
    raw.rkMax !== undefined && raw.rkMax !== null
      ? raw.rkMax
      : raw.kind === "vzh"
        ? 2
        : null;
  return { ...raw, rkUserIds, rkMax };
}

export async function getRosterRecord(messageId: string): Promise<RosterRecord | null> {
  const map = await readAll();
  const r = map[messageId];
  return r ? normalizeRoster(r) : null;
}

export async function upsertRosterRecord(record: RosterRecord): Promise<void> {
  const map = await readAll();
  map[record.messageId] = record;
  await writeAll(map);
}

export async function deleteRosterRecord(messageId: string): Promise<void> {
  const map = await readAll();
  if (!map[messageId]) return;
  delete map[messageId];
  await writeAll(map);
}
