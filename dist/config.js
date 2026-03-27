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
function getEnvOptional(name) {
    const v = process.env[name];
    const t = v?.trim();
    return t && t.length > 0 ? t : undefined;
}
function parseDiscordId(name) {
    const raw = mustGetEnv(name);
    // Discord snowflakes are digits; keep as string for precision.
    if (!/^\d+$/.test(raw.trim())) {
        throw new Error(`Env var ${name} must be digits, got: ${raw}`);
    }
    return raw.trim();
}
function parseDiscordIdOptional(name) {
    const raw = getEnvOptional(name);
    if (!raw)
        return undefined;
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
function parseDiscordIdListOptional(name) {
    const raw = getEnvOptional(name);
    if (!raw)
        return undefined;
    const parts = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0)
        return undefined;
    for (const p of parts) {
        if (!/^\d+$/.test(p)) {
            throw new Error(`Env var ${name} must be comma-separated digits, got: ${raw}`);
        }
    }
    return parts;
}
function parseIntOptional(name) {
    const raw = getEnvOptional(name);
    if (!raw)
        return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new Error(`Env var ${name} must be an integer, got: ${raw}`);
    }
    return n;
}
exports.config = {
    DISCORD_TOKEN: mustGetEnv("DISCORD_TOKEN"),
    GUILD_ID: parseDiscordId("GUILD_ID"),
    CATEGORY_ID: parseDiscordId("CATEGORY_ID"),
    LOG_CHANNEL_ID: parseDiscordId("LOG_CHANNEL_ID"),
    PANEL_CHANNEL_ID: parseDiscordId("PANEL_CHANNEL_ID"),
    MODERATOR_ROLE_IDS: parseDiscordIdList("MODERATOR_ROLE_ID"),
    APPLICATIONS_BASE_PATH: mustGetEnv("APPLICATIONS_BASE_PATH"),
    WEEKLY_TICKETS_REPORT_CHANNEL_ID: parseDiscordIdOptional("WEEKLY_TICKETS_REPORT_CHANNEL_ID"),
    WEEKLY_TICKETS_REPORT_DOW: parseIntOptional("WEEKLY_TICKETS_REPORT_DOW") ?? 0,
    WEEKLY_TICKETS_REPORT_HOUR: parseIntOptional("WEEKLY_TICKETS_REPORT_HOUR") ?? 23,
    WEEKLY_TICKETS_REPORT_MINUTE: parseIntOptional("WEEKLY_TICKETS_REPORT_MINUTE") ?? 55,
    WEEKLY_TICKETS_TZ_OFFSET_MINUTES: parseIntOptional("WEEKLY_TICKETS_TZ_OFFSET_MINUTES") ?? 0,
    VOICE_POINTS_PANEL_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_PANEL_CHANNEL_ID"),
    VOICE_POINTS_LOG_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_LOG_CHANNEL_ID"),
    VOICE_POINTS_AFK_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_AFK_CHANNEL_ID"),
    VOICE_POINTS_PER_MINUTE: parseIntOptional("VOICE_POINTS_PER_MINUTE") ?? 1,
    VOICE_POINTS_GRANT_ROLE_IDS: parseDiscordIdListOptional("VOICE_POINTS_GRANT_ROLE_ID") ?? [],
    AFK_PANEL_CHANNEL_ID: parseDiscordIdOptional("AFK_PANEL_CHANNEL_ID"),
    AFK_LOG_CHANNEL_ID: parseDiscordIdOptional("AFK_LOG_CHANNEL_ID"),
    AFK_MAX_MINUTES: parseIntOptional("AFK_MAX_MINUTES") ?? 12 * 60,
    TWITCH_ANNOUNCE_CHANNEL_ID: parseDiscordIdOptional("TWITCH_ANNOUNCE_CHANNEL_ID"),
    TWITCH_CLIENT_ID: getEnvOptional("TWITCH_CLIENT_ID"),
    TWITCH_CLIENT_SECRET: getEnvOptional("TWITCH_CLIENT_SECRET"),
    TWITCH_STREAMERS: (getEnvOptional("TWITCH_STREAMERS") ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    TWITCH_ANNOUNCE_MENTION: getEnvOptional("TWITCH_ANNOUNCE_MENTION"),
    TWITCH_POLL_SECONDS: parseIntOptional("TWITCH_POLL_SECONDS") ?? 90,
};
