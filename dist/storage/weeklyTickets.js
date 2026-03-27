"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendWeeklyTicketEvent = appendWeeklyTicketEvent;
exports.readWeeklyTicketsReportState = readWeeklyTicketsReportState;
exports.writeWeeklyTicketsReportState = writeWeeklyTicketsReportState;
exports.listWeeklyTicketEvents = listWeeklyTicketEvents;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const eventsPath = path_1.default.join(dataDir, "weeklyTickets.events.json");
const reportStatePath = path_1.default.join(dataDir, "weeklyTickets.reportState.json");
async function ensureDataDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readEvents() {
    try {
        const raw = await fs_1.promises.readFile(eventsPath, "utf8");
        if (!raw.trim())
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return [];
        throw e;
    }
}
async function writeEvents(events) {
    await ensureDataDir();
    await fs_1.promises.writeFile(eventsPath, JSON.stringify(events, null, 2), "utf8");
}
async function appendWeeklyTicketEvent(event) {
    const events = await readEvents();
    events.push(event);
    await writeEvents(events);
}
async function readWeeklyTicketsReportState() {
    try {
        const raw = await fs_1.promises.readFile(reportStatePath, "utf8");
        if (!raw.trim())
            return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return {};
        throw e;
    }
}
async function writeWeeklyTicketsReportState(state) {
    await ensureDataDir();
    await fs_1.promises.writeFile(reportStatePath, JSON.stringify(state, null, 2), "utf8");
}
async function listWeeklyTicketEvents() {
    return await readEvents();
}
