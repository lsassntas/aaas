"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRpRosterLock = withRpRosterLock;
exports.getRosterRecord = getRosterRecord;
exports.upsertRosterRecord = upsertRosterRecord;
exports.deleteRosterRecord = deleteRosterRecord;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const storePath = path_1.default.join(dataDir, "rp-rosters.json");
const rosterLock = new Map();
async function withRpRosterLock(messageId, fn) {
    const prev = rosterLock.get(messageId) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => (release = res));
    rosterLock.set(messageId, prev.then(() => next));
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
        if (rosterLock.get(messageId))
            rosterLock.delete(messageId);
    }
}
async function ensureDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readAll() {
    try {
        const raw = await fs_1.promises.readFile(storePath, "utf8");
        if (!raw.trim())
            return {};
        return JSON.parse(raw);
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return {};
        throw e;
    }
}
async function writeAll(map) {
    await ensureDir();
    await fs_1.promises.writeFile(storePath, JSON.stringify(map, null, 2), "utf8");
}
function normalizeRoster(raw) {
    const rkUserIds = raw.rkUserIds ?? [];
    const rkMax = raw.rkMax !== undefined && raw.rkMax !== null
        ? raw.rkMax
        : raw.kind === "vzh"
            ? 2
            : null;
    return { ...raw, rkUserIds, rkMax };
}
async function getRosterRecord(messageId) {
    const map = await readAll();
    const r = map[messageId];
    return r ? normalizeRoster(r) : null;
}
async function upsertRosterRecord(record) {
    const map = await readAll();
    map[record.messageId] = record;
    await writeAll(map);
}
async function deleteRosterRecord(messageId) {
    const map = await readAll();
    if (!map[messageId])
        return;
    delete map[messageId];
    await writeAll(map);
}
