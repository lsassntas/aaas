"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOICE_GRANT_MODAL_ID = exports.VOICE_PANEL_GRANT_ID = void 0;
exports.grantModal = grantModal;
exports.handleGrantButton = handleGrantButton;
exports.handleGrantModal = handleGrantModal;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const voicePoints_1 = require("../storage/voicePoints");
exports.VOICE_PANEL_GRANT_ID = "voice:grant";
exports.VOICE_GRANT_MODAL_ID = "voice:grantModal";
function canGrant(member) {
    const ids = config_1.config.VOICE_POINTS_GRANT_ROLE_IDS ?? [];
    if (ids.length === 0)
        return false;
    return ids.some((id) => member.roles.cache.has(id));
}
function parseUserId(input) {
    const t = input.trim();
    if (!t)
        return null;
    // <@123> or <@!123>
    const m = t.match(/^<@!?(\d+)>$/);
    if (m?.[1])
        return m[1];
    if (/^\d+$/.test(t))
        return t;
    return null;
}
function parseAmount(input) {
    const t = input.trim().replace(",", ".");
    if (!t)
        return null;
    const n = Number(t);
    if (!Number.isFinite(n))
        return null;
    const i = Math.floor(n);
    if (i <= 0)
        return null;
    return i;
}
function grantModal() {
    const modal = new discord_js_1.ModalBuilder().setCustomId(exports.VOICE_GRANT_MODAL_ID).setTitle("Выдать баллы");
    const user = new discord_js_1.TextInputBuilder()
        .setCustomId("user")
        .setLabel("Пользователь (mention или ID)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true);
    const amount = new discord_js_1.TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Сколько баллов")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(12)
        .setRequired(true);
    const reason = new discord_js_1.TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Причина (необязательно)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(false);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(user), new discord_js_1.ActionRowBuilder().addComponents(amount), new discord_js_1.ActionRowBuilder().addComponents(reason));
    return modal;
}
async function handleGrantButton(interaction) {
    if (interaction.customId !== exports.VOICE_PANEL_GRANT_ID)
        return false;
    if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Команда доступна только на сервере.", flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        return true;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !canGrant(member)) {
        await interaction.reply({ content: "У вас нет прав выдавать баллы.", flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        return true;
    }
    await interaction.showModal(grantModal());
    return true;
}
async function handleGrantModal(interaction) {
    if (interaction.customId !== exports.VOICE_GRANT_MODAL_ID)
        return false;
    if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Команда доступна только на сервере.", flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        return true;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !canGrant(member)) {
        await interaction.reply({ content: "У вас нет прав выдавать баллы.", flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        return true;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    const rawUser = interaction.fields.getTextInputValue("user");
    const rawAmount = interaction.fields.getTextInputValue("amount");
    const reason = (interaction.fields.getTextInputValue("reason") ?? "").trim();
    const targetUserId = parseUserId(rawUser);
    const amount = parseAmount(rawAmount);
    if (!targetUserId || !amount) {
        await interaction.editReply({ content: "Неверные данные. Укажи пользователя (mention/ID) и число баллов." }).catch(() => { });
        return true;
    }
    // Basic guild safety: require that the user exists in this guild.
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
        await interaction.editReply({ content: "Пользователь не найден на сервере." }).catch(() => { });
        return true;
    }
    // Optional permission: if you want, require ManageGuild etc. For now roles control access.
    const before = await (0, voicePoints_1.getBalance)(interaction.guild.id, targetUserId);
    const after = await (0, voicePoints_1.addBalance)(interaction.guild.id, targetUserId, amount);
    await interaction
        .editReply({
        content: `Выдано **${amount}** баллов пользователю <@${targetUserId}>.\n` +
            `Было: **${before}**, стало: **${after}**.` +
            (reason ? `\nПричина: ${reason}` : ""),
    })
        .catch(() => { });
    if (config_1.config.VOICE_POINTS_LOG_CHANNEL_ID) {
        const log = await interaction.client.channels.fetch(config_1.config.VOICE_POINTS_LOG_CHANNEL_ID).catch(() => null);
        if (!log) {
            console.warn(`[voicePoints:log] Log channel not found: ${config_1.config.VOICE_POINTS_LOG_CHANNEL_ID}`);
        }
        else if (!log.isTextBased()) {
            console.warn(`[voicePoints:log] Log channel is not text-based: ${config_1.config.VOICE_POINTS_LOG_CHANNEL_ID}`);
        }
        else {
            const textLog = log;
            await textLog
                .send({
                content: `Выдача баллов: <@${interaction.user.id}> выдал(а) <@${targetUserId}> **${amount}** баллов.` +
                    (reason ? ` Причина: ${reason}` : ""),
                allowedMentions: { users: [interaction.user.id, targetUserId] },
            })
                .catch((e) => console.warn("[voicePoints:log] Failed to send grant log:", e));
        }
    }
    else {
        console.log("[voicePoints:log] VOICE_POINTS_LOG_CHANNEL_ID not set; skipping grant log");
    }
    return true;
}
