"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertApplication = upsertApplication;
exports.getApplication = getApplication;
exports.getApplicationByChannelId = getApplicationByChannelId;
exports.deleteApplication = deleteApplication;
exports.updateApplicationStatus = updateApplicationStatus;
exports.ensureBaseDirectories = ensureBaseDirectories;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const dataDir = path_1.default.resolve(process.cwd(), "data");
const mappingPath = path_1.default.join(dataDir, "mapping.json");
async function ensureDataDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readAll() {
    try {
        const raw = await fs_1.promises.readFile(mappingPath, "utf8");
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
    await ensureDataDir();
    await fs_1.promises.writeFile(mappingPath, JSON.stringify(map, null, 2), "utf8");
}
async function upsertApplication(record) {
    const map = await readAll();
    map[record.applicationId] = record;
    await writeAll(map);
}
async function getApplication(applicationId) {
    const map = await readAll();
    return map[applicationId] ?? null;
}
async function getApplicationByChannelId(discordChannelId) {
    const map = await readAll();
    const found = Object.values(map).find((r) => r.discordChannelId === discordChannelId);
    return found ?? null;
}
async function deleteApplication(applicationId) {
    const map = await readAll();
    delete map[applicationId];
    await writeAll(map);
}
async function updateApplicationStatus(applicationId, status) {
    const map = await readAll();
    const rec = map[applicationId];
    if (!rec)
        return;
    rec.status = status;
    map[applicationId] = rec;
    await writeAll(map);
}
async function ensureBaseDirectories() {
    const base = path_1.default.resolve(process.cwd(), config_1.config.APPLICATIONS_BASE_PATH);
    await fs_1.promises.mkdir(base, { recursive: true });
    await ensureDataDir();
}
