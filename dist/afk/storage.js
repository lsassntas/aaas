"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAfk = listAfk;
exports.isUserAfk = isUserAfk;
exports.upsertAfk = upsertAfk;
exports.removeAfk = removeAfk;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const storePath = path_1.default.join(dataDir, "afk.json");
async function ensureDataDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readAll() {
    try {
        const raw = await fs_1.promises.readFile(storePath, "utf8");
        if (!raw.trim())
            return { entries: [] };
        const parsed = JSON.parse(raw);
        return { entries: parsed.entries ?? [] };
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return { entries: [] };
        throw e;
    }
}
async function writeAll(data) {
    await ensureDataDir();
    await fs_1.promises.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}
function nowIso() {
    return new Date().toISOString();
}
function isExpired(entry, nowMs) {
    const untilMs = Date.parse(entry.untilIso);
    return Number.isFinite(untilMs) && untilMs <= nowMs;
}
async function listAfk(guildId, nowMs = Date.now()) {
    const data = await readAll();
    const alive = data.entries.filter((e) => e.guildId === guildId && !isExpired(e, nowMs));
    if (alive.length !== data.entries.length) {
        data.entries = data.entries.filter((e) => !isExpired(e, nowMs));
        await writeAll(data);
    }
    return alive.sort((a, b) => Date.parse(a.untilIso) - Date.parse(b.untilIso));
}
async function isUserAfk(guildId, userId, nowMs = Date.now()) {
    const list = await listAfk(guildId, nowMs);
    return list.some((e) => e.userId === userId);
}
async function upsertAfk(params) {
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
async function removeAfk(guildId, userId) {
    const data = await readAll();
    const before = data.entries.length;
    data.entries = data.entries.filter((e) => !(e.guildId === guildId && e.userId === userId));
    if (data.entries.length !== before)
        await writeAll(data);
}
