"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withContractLock = withContractLock;
exports.getContractRosterRecord = getContractRosterRecord;
exports.upsertContractRosterRecord = upsertContractRosterRecord;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const storePath = path_1.default.join(dataDir, "contract-rosters.json");
const contractLock = new Map();
async function withContractLock(messageId, fn) {
    const prev = contractLock.get(messageId) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => (release = res));
    contractLock.set(messageId, prev.then(() => next));
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
        if (contractLock.get(messageId))
            contractLock.delete(messageId);
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
async function getContractRosterRecord(messageId) {
    const map = await readAll();
    return map[messageId] ?? null;
}
async function upsertContractRosterRecord(record) {
    const map = await readAll();
    map[record.messageId] = record;
    await writeAll(map);
}
