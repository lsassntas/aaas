"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.addBalance = addBalance;
exports.subtractBalanceIfEnough = subtractBalanceIfEnough;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const storePath = path_1.default.join(dataDir, "voice_points.json");
const storeBackupPath = path_1.default.join(dataDir, "voice_points.corrupt.json");
let fileLock = Promise.resolve();
async function withFileLock(fn) {
    const prev = fileLock;
    let release;
    fileLock = new Promise((res) => (release = res));
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
    }
}
async function ensureDataDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readAll() {
    try {
        const raw = await fs_1.promises.readFile(storePath, "utf8");
        if (!raw.trim())
            return { balances: {} };
        try {
            const parsed = JSON.parse(raw);
            return { balances: parsed.balances ?? {} };
        }
        catch (parseErr) {
            // Keep the broken file for manual inspection, then self-heal.
            await ensureDataDir();
            await fs_1.promises.writeFile(storeBackupPath, raw, "utf8").catch(() => { });
            console.warn("[voicePoints] Corrupted voice_points.json detected; backup saved and store reset.");
            return { balances: {} };
        }
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return { balances: {} };
        throw e;
    }
}
async function writeAll(data) {
    await ensureDataDir();
    await fs_1.promises.writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
}
function key(guildId, userId) {
    return `${guildId}:${userId}`;
}
async function getBalance(guildId, userId) {
    const data = await readAll();
    return data.balances[key(guildId, userId)] ?? 0;
}
async function addBalance(guildId, userId, delta) {
    if (!Number.isFinite(delta))
        return getBalance(guildId, userId);
    return await withFileLock(async () => {
        const data = await readAll();
        const k = key(guildId, userId);
        const next = Math.max(0, Math.floor((data.balances[k] ?? 0) + delta));
        data.balances[k] = next;
        await writeAll(data);
        return next;
    });
}
async function subtractBalanceIfEnough(guildId, userId, cost) {
    return await withFileLock(async () => {
        const c = Math.max(0, Math.floor(cost));
        const data = await readAll();
        const k = key(guildId, userId);
        const cur = Math.max(0, Math.floor(data.balances[k] ?? 0));
        if (cur < c)
            return { ok: false, balance: cur };
        const next = cur - c;
        data.balances[k] = next;
        await writeAll(data);
        return { ok: true, balance: next };
    });
}
