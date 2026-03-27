import { promises as fs } from "fs";
import path from "path";

export type TwitchLiveState = {
  // streamerLogin -> last announced stream id
  lastAnnouncedStreamIdByLogin: Record<string, string | undefined>;
};

const dataDir = path.resolve(process.cwd(), "data");
const statePath = path.join(dataDir, "twitch.liveState.json");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readTwitchLiveState(): Promise<TwitchLiveState> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    if (!raw.trim()) {
      return { lastAnnouncedStreamIdByLogin: {} };
    }
    const parsed = JSON.parse(raw) as TwitchLiveState;
    if (!parsed || typeof parsed !== "object") return { lastAnnouncedStreamIdByLogin: {} };
    const map = (parsed as any).lastAnnouncedStreamIdByLogin;
    if (!map || typeof map !== "object") return { lastAnnouncedStreamIdByLogin: {} };
    return { lastAnnouncedStreamIdByLogin: map as Record<string, string | undefined> };
  } catch (e: any) {
    if (e?.code === "ENOENT") return { lastAnnouncedStreamIdByLogin: {} };
    throw e;
  }
}

export async function writeTwitchLiveState(state: TwitchLiveState): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

