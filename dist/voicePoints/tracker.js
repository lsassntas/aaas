"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installVoicePointsTracker = installVoicePointsTracker;
const config_1 = require("../config");
const voicePoints_1 = require("../storage/voicePoints");
const storage_1 = require("../afk/storage");
function sessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}
async function isEligible(state) {
    const ch = state.channel;
    if (!ch)
        return false;
    if (config_1.config.VOICE_POINTS_AFK_CHANNEL_ID && ch.id === config_1.config.VOICE_POINTS_AFK_CHANNEL_ID)
        return false;
    // Disallow if user is muted/deafened by self or server.
    if (state.selfMute || state.serverMute)
        return false;
    if (state.selfDeaf || state.serverDeaf)
        return false;
    // Stage channels / suppressed state: treat as not eligible for earning.
    if (state.suppress)
        return false;
    // If member is a bot, ignore.
    if (state.member?.user?.bot)
        return false;
    // If user marked as AFK (panel), don't earn.
    if (state.guild?.id && state.id) {
        const afk = await (0, storage_1.isUserAfk)(state.guild.id, state.id).catch(() => false);
        if (afk)
            return false;
    }
    return true;
}
function installVoicePointsTracker(client) {
    const sessions = new Map(); // startMs
    async function stopAndCredit(state, stopMs) {
        const guildId = state.guild?.id;
        const userId = state.id;
        if (!guildId || !userId)
            return;
        const k = sessionKey(guildId, userId);
        const start = sessions.get(k);
        if (!start)
            return;
        sessions.delete(k);
        const elapsedMs = Math.max(0, stopMs - start);
        const minutes = Math.floor(elapsedMs / 60_000);
        if (minutes <= 0)
            return;
        await (0, voicePoints_1.addBalance)(guildId, userId, minutes * config_1.config.VOICE_POINTS_PER_MINUTE).catch((e) => {
            console.error("[voicePoints:tracker] Failed to add balance:", e);
        });
    }
    function start(state, startMs) {
        const guildId = state.guild?.id;
        const userId = state.id;
        if (!guildId || !userId)
            return;
        sessions.set(sessionKey(guildId, userId), startMs);
    }
    client.on("voiceStateUpdate", async (oldState, newState) => {
        try {
            const now = Date.now();
            const was = await isEligible(oldState);
            const nowEligible = await isEligible(newState);
            if (!was && nowEligible) {
                start(newState, now);
                return;
            }
            if (was && !nowEligible) {
                await stopAndCredit(oldState, now);
                return;
            }
            // If still eligible, do nothing (session continues across channel moves).
        }
        catch (e) {
            console.error("[voicePoints:tracker] voiceStateUpdate failed:", e);
        }
    });
    client.on("ready", async () => {
        try {
            if (!config_1.config.VOICE_POINTS_PANEL_CHANNEL_ID)
                return;
            const guild = await client.guilds.fetch(config_1.config.GUILD_ID).catch(() => null);
            if (!guild)
                return;
            const fullGuild = await guild.fetch().catch(() => null);
            if (!fullGuild)
                return;
            for (const vs of fullGuild.voiceStates.cache.values()) {
                if (await isEligible(vs))
                    start(vs, Date.now());
            }
        }
        catch (e) {
            console.error("[voicePoints:tracker] ready init failed:", e);
        }
    });
}
