"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
function mustGetEnv(name) {
    const v = process.env[name];
    if (!v || v.trim().length === 0) {
        throw new Error(`Missing env var: ${name}`);
    }
    return v;
}
function parseDiscordId(name) {
    const raw = mustGetEnv(name);
    // Discord snowflakes are digits; keep as string for precision.
    if (!/^\d+$/.test(raw.trim())) {
        throw new Error(`Env var ${name} must be digits, got: ${raw}`);
    }
    return raw.trim();
}
function parseDiscordIdList(name) {
    const raw = mustGetEnv(name);
    const parts = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0) {
        throw new Error(`Env var ${name} must contain at least one id`);
    }
    for (const p of parts) {
        if (!/^\d+$/.test(p)) {
            throw new Error(`Env var ${name} must be comma-separated digits, got: ${raw}`);
        }
    }
    return parts;
}
exports.config = {
    DISCORD_TOKEN: mustGetEnv("DISCORD_TOKEN"),
    GUILD_ID: parseDiscordId("GUILD_ID"),
    CATEGORY_ID: parseDiscordId("CATEGORY_ID"),
    LOG_CHANNEL_ID: parseDiscordId("LOG_CHANNEL_ID"),
    PANEL_CHANNEL_ID: parseDiscordId("PANEL_CHANNEL_ID"),
    MODERATOR_ROLE_IDS: parseDiscordIdList("MODERATOR_ROLE_ID"),
    APPLICATIONS_BASE_PATH: mustGetEnv("APPLICATIONS_BASE_PATH")
};
