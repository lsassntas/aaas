import { promises as fs } from "fs";
import path from "path";

type VoicePointsData = {
  balances: Record<string, number>; // key: `${guildId}:${userId}`
};

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "voice_points.json");
const storeBackupPath = path.join(dataDir, "voice_points.corrupt.json");
let fileLock: Promise<void> = Promise.resolve();

async function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = fileLock;
  let release!: () => void;
  fileLock = new Promise<void>((res) => (release = res));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readAll(): Promise<VoicePointsData> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) return { balances: {} };
    try {
      const parsed = JSON.parse(raw) as Partial<VoicePointsData>;
      return { balances: parsed.balances ?? {} };
    } catch (parseErr) {
      // Keep the broken file for manual inspection, then self-heal.
      await ensureDataDir();
      await fs.writeFile(storeBackupPath, raw, "utf8").catch(() => {});
      console.warn("[voicePoints] Corrupted voice_points.json detected; backup saved and store reset.");
      return { balances: {} };
    }
  } catch (e: any) {
    if (e?.code === "ENOENT") return { balances: {} };
    throw e;
  }
}

async function writeAll(data: VoicePointsData) {
  await ensureDataDir();
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export async function getBalance(guildId: string, userId: string): Promise<number> {
  const data = await readAll();
  return data.balances[key(guildId, userId)] ?? 0;
}

export async function addBalance(guildId: string, userId: string, delta: number): Promise<number> {
  if (!Number.isFinite(delta)) return getBalance(guildId, userId);
  return await withFileLock(async () => {
    const data = await readAll();
    const k = key(guildId, userId);
    const next = Math.max(0, Math.floor((data.balances[k] ?? 0) + delta));
    data.balances[k] = next;
    await writeAll(data);
    return next;
  });
}

export async function subtractBalanceIfEnough(
  guildId: string,
  userId: string,
  cost: number,
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  return await withFileLock(async () => {
    const c = Math.max(0, Math.floor(cost));
    const data = await readAll();
    const k = key(guildId, userId);
    const cur = Math.max(0, Math.floor(data.balances[k] ?? 0));
    if (cur < c) return { ok: false, balance: cur };
    const next = cur - c;
    data.balances[k] = next;
    await writeAll(data);
    return { ok: true, balance: next };
  });
}

