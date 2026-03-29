import { promises as fs } from "fs";
import path from "path";

export type WeeklyTicketEvent = {
  guildId: string;
  moderatorUserId: string;
  applicationId: string;
  decision: "accepted" | "rejected";
  atIso: string; // ISO timestamp
};

const dataDir = path.resolve(process.cwd(), "data");
const eventsPath = path.join(dataDir, "weeklyTickets.events.json");
const reportStatePath = path.join(dataDir, "weeklyTickets.reportState.json");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readEvents(): Promise<WeeklyTicketEvent[]> {
  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as WeeklyTicketEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
}

async function writeEvents(events: WeeklyTicketEvent[]) {
  await ensureDataDir();
  await fs.writeFile(eventsPath, JSON.stringify(events, null, 2), "utf8");
}

export async function appendWeeklyTicketEvent(event: WeeklyTicketEvent) {
  const events = await readEvents();
  events.push(event);
  await writeEvents(events);
}

export type WeeklyTicketsReportState = {
  lastPostedWeekKey?: string;
};

export async function readWeeklyTicketsReportState(): Promise<WeeklyTicketsReportState> {
  try {
    const raw = await fs.readFile(reportStatePath, "utf8");
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as WeeklyTicketsReportState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e: any) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

export async function writeWeeklyTicketsReportState(state: WeeklyTicketsReportState) {
  await ensureDataDir();
  await fs.writeFile(reportStatePath, JSON.stringify(state, null, 2), "utf8");
}

export async function listWeeklyTicketEvents(): Promise<WeeklyTicketEvent[]> {
  return await readEvents();
}

