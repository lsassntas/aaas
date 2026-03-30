"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishOrUpdateAfkPanel = publishOrUpdateAfkPanel;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const storage_1 = require("./storage");
const ui_1 = require("./ui");
function formatLines(entries) {
    return entries.map((e) => {
        const untilTs = Math.floor(Date.parse(e.untilIso) / 1000);
        const reason = e.reason?.trim() ? ` — ${e.reason.trim()}` : "";
        return `- <@${e.userId}> до <t:${untilTs}:t>${reason}`;
    });
}
async function publishOrUpdateAfkPanel(client) {
    if (!config_1.config.AFK_PANEL_CHANNEL_ID) {
        console.log("[afk:panel] AFK_PANEL_CHANNEL_ID not set; skipping panel publish");
        return;
    }
    const channel = await client.channels.fetch(config_1.config.AFK_PANEL_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.warn(`[afk:panel] Channel not found: ${config_1.config.AFK_PANEL_CHANNEL_ID}`);
        return;
    }
    if (!channel.isTextBased()) {
        console.warn(`[afk:panel] Channel is not text-based: ${config_1.config.AFK_PANEL_CHANNEL_ID}`);
        return;
    }
    const textChannel = channel;
    const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
    const perms = me ? textChannel.permissionsFor(me) : null;
    if (!perms?.has([discord_js_1.PermissionsBitField.Flags.ViewChannel, discord_js_1.PermissionsBitField.Flags.SendMessages])) {
        console.warn(`[afk:panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages`);
        return;
    }
    const entries = await (0, storage_1.listAfk)(textChannel.guild.id).catch(() => []);
    const embed = (0, ui_1.afkEmbed)(formatLines(entries));
    const components = [(0, ui_1.afkButtons)()];
    const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (recent) {
        for (const m of recent.values()) {
            const embeds = m.embeds ?? [];
            const has = embeds.some((e) => String(e?.title ?? "") === "Список АФК");
            if (!has)
                continue;
            await m.edit({ embeds: [embed], components }).catch(() => { });
            return;
        }
    }
    await textChannel
        .send({ embeds: [embed], components })
        .then(() => console.log(`[afk:panel] Panel sent to #${textChannel?.name ?? textChannel.id}`))
        .catch((e) => console.warn("[afk:panel] Failed to send panel:", e));
}
