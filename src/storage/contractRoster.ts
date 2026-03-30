import { promises as fs } from "fs";
import path from "path";

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "contract-rosters.json");

const contractLock = new Map<string, Promise<void>>();

export type ContractRosterRecord = {
  messageId: string;
  channelId: string;
  guildId: string;
  joinedUserIds: string[];
  cost: number;
};

export async function withContractLock<T>(messageId: string, fn: () => Promise<T>): Promise<T> {
  const prev = contractLock.get(messageId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => (release = res));
  contractLock.set(messageId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (contractLock.get(messageId)) contractLock.delete(messageId);
  }
}

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readAll(): Promise<Record<string, ContractRosterRecord>> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Record<string, ContractRosterRecord>;
  } catch (e: any) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

async function writeAll(map: Record<string, ContractRosterRecord>) {
  await ensureDir();
  await fs.writeFile(storePath, JSON.stringify(map, null, 2), "utf8");
}

export async function getContractRosterRecord(messageId: string): Promise<ContractRosterRecord | null> {
  const map = await readAll();
  return map[messageId] ?? null;
}

export async function upsertContractRosterRecord(record: ContractRosterRecord): Promise<void> {
  const map = await readAll();
  map[record.messageId] = record;
  await writeAll(map);
}
