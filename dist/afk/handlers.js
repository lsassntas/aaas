"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAfkButton = handleAfkButton;
exports.handleAfkModal = handleAfkModal;
exports.cleanupAfkLoop = cleanupAfkLoop;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const storage_1 = require("./storage");
const panel_1 = require("./panel");
const ui_1 = require("./ui");
function parseHhMm(input) {
    const t = input.trim();
    const m = t.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
    if (!m)
        return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm))
        return null;
    if (hh < 0 || mm < 0 || mm >= 60)
        return null;
    const minutes = hh * 60 + mm;
    if (minutes <= 0)
        return null;
    return { minutes };
}
async function logToAfkChannel(client, guildId, content) {
    if (!config_1.config.AFK_LOG_CHANNEL_ID)
        return;
    const ch = await client.channels.fetch(config_1.config.AFK_LOG_CHANNEL_ID).catch(() => null);
    if (!ch || !ch.isTextBased())
        return;
    const text = ch;
    if (text.guild.id !== guildId)
        return;
    await text.send({ content }).catch(() => { });
}
async function handleAfkButton(interaction) {
    if (!interaction.inGuild() || !interaction.guild)
        return false;
    const id = interaction.customId;
    if (!id.startsWith("afk:"))
        return false;
    if (id === ui_1.AFK_ENTER_BUTTON_ID) {
        await interaction.showModal((0, ui_1.afkEnterModal)());
        return true;
    }
    if (id === ui_1.AFK_EXIT_BUTTON_ID) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        await (0, storage_1.removeAfk)(interaction.guild.id, interaction.user.id);
        await (0, panel_1.publishOrUpdateAfkPanel)(interaction.client);
        await logToAfkChannel(interaction.client, interaction.guild.id, `АФК: <@${interaction.user.id}> вышел(ла) из АФК.`);
        await interaction.editReply({ content: "Вы вышли из АФК." }).catch(() => { });
        return true;
    }
    return false;
}
async function handleAfkModal(interaction) {
    if (!interaction.inGuild() || !interaction.guild)
        return false;
    if (interaction.customId !== ui_1.AFK_ENTER_MODAL_ID)
        return false;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    const reason = (interaction.fields.getTextInputValue("reason") ?? "").trim();
    const time = (interaction.fields.getTextInputValue("time") ?? "").trim();
    const parsed = parseHhMm(time);
    if (!reason || !parsed) {
        await interaction.editReply({ content: "Неверные данные. Укажи причину и время в формате ЧЧ:ММ (например 1:30)." }).catch(() => { });
        return true;
    }
    const minutes = Math.min(parsed.minutes, config_1.config.AFK_MAX_MINUTES);
    await (0, storage_1.upsertAfk)({ guildId: interaction.guild.id, userId: interaction.user.id, reason, minutes });
    await (0, panel_1.publishOrUpdateAfkPanel)(interaction.client);
    const untilTs = Math.floor((Date.now() + minutes * 60_000) / 1000);
    await logToAfkChannel(interaction.client, interaction.guild.id, `АФК: <@${interaction.user.id}> встал(а) в АФК до <t:${untilTs}:t>. Причина: ${reason}`);
    await interaction.editReply({ content: `Вы в АФК до <t:${untilTs}:t>.` }).catch(() => { });
    return true;
}
async function cleanupAfkLoop(client) {
    if (!config_1.config.AFK_PANEL_CHANNEL_ID)
        return;
    let lastSignature = "";
    setInterval(async () => {
        const guild = await client.guilds.fetch(config_1.config.GUILD_ID).catch(() => null);
        if (!guild)
            return;
        const entries = await (0, storage_1.listAfk)(guild.id).catch(() => []);
        const signature = JSON.stringify(entries.map((e) => [e.userId, e.untilIso, e.reason]));
        if (signature !== lastSignature) {
            lastSignature = signature;
            await (0, panel_1.publishOrUpdateAfkPanel)(client);
        }
    }, 60_000).unref?.();
}
