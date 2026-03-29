"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVoicePointsPanelIfMissing = registerVoicePointsPanelIfMissing;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const ui_1 = require("./ui");
async function registerVoicePointsPanelIfMissing(client) {
    if (!config_1.config.VOICE_POINTS_PANEL_CHANNEL_ID) {
        console.log("[voicePoints:panel] VOICE_POINTS_PANEL_CHANNEL_ID not set; skipping panel publish");
        return;
    }
    const channel = await client.channels.fetch(config_1.config.VOICE_POINTS_PANEL_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.warn(`[voicePoints:panel] Channel not found: ${config_1.config.VOICE_POINTS_PANEL_CHANNEL_ID}`);
        return;
    }
    if (!channel.isTextBased()) {
        console.warn(`[voicePoints:panel] Channel is not text-based: ${config_1.config.VOICE_POINTS_PANEL_CHANNEL_ID}`);
        return;
    }
    const textChannel = channel;
    const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
    const perms = me ? textChannel.permissionsFor(me) : null;
    if (!perms?.has([discord_js_1.PermissionsBitField.Flags.ViewChannel, discord_js_1.PermissionsBitField.Flags.SendMessages])) {
        console.warn(`[voicePoints:panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages`);
        return;
    }
    const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (recent) {
        for (const m of recent.values()) {
            const embeds = m.embeds ?? [];
            const rows = m.components ?? [];
            const hasOurEmbed = embeds.some((e) => {
                const t = String(e?.title ?? "");
                return t === "Баллы за войс — Sportik" || t === "Баллы за войс — FENIMORE";
            });
            if (!hasOurEmbed)
                continue;
            const hasOurButtons = rows.some((row) => (row?.components ?? []).some((c) => String(c?.customId ?? "").startsWith("voice:")));
            if (hasOurButtons) {
                await m.edit({ embeds: [(0, ui_1.voicePointsEmbed)()], components: [(0, ui_1.voicePointsButtons)()] }).catch(() => { });
                return;
            }
        }
    }
    await textChannel
        .send({ embeds: [(0, ui_1.voicePointsEmbed)()], components: [(0, ui_1.voicePointsButtons)()] })
        .then(() => console.log(`[voicePoints:panel] Panel sent to #${textChannel?.name ?? textChannel.id}`))
        .catch((e) => console.warn("[voicePoints:panel] Failed to send panel:", e));
}
