"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTwitchLiveState = readTwitchLiveState;
exports.writeTwitchLiveState = writeTwitchLiveState;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.resolve(process.cwd(), "data");
const statePath = path_1.default.join(dataDir, "twitch.liveState.json");
async function ensureDataDir() {
    await fs_1.promises.mkdir(dataDir, { recursive: true });
}
async function readTwitchLiveState() {
    try {
        const raw = await fs_1.promises.readFile(statePath, "utf8");
        if (!raw.trim()) {
            return { lastAnnouncedStreamIdByLogin: {} };
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return { lastAnnouncedStreamIdByLogin: {} };
        const map = parsed.lastAnnouncedStreamIdByLogin;
        if (!map || typeof map !== "object")
            return { lastAnnouncedStreamIdByLogin: {} };
        return { lastAnnouncedStreamIdByLogin: map };
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return { lastAnnouncedStreamIdByLogin: {} };
        throw e;
    }
}
async function writeTwitchLiveState(state) {
    await ensureDataDir();
    await fs_1.promises.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}
