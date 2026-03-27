"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVoicePointsButton = handleVoicePointsButton;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const voicePoints_1 = require("../storage/voicePoints");
const ui_1 = require("./ui");
const grant_1 = require("./grant");
const GOODS = {
    contract_pick: { label: "Пик контракта", cost: 150 },
    remove_jamb: { label: "Снятие косяка", cost: 250 },
};
async function handleVoicePointsButton(interaction) {
    if (!interaction.guild)
        return false;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const id = interaction.customId;
    if (!id.startsWith("voice:"))
        return false;
    if (id === grant_1.VOICE_PANEL_GRANT_ID) {
        return await (0, grant_1.handleGrantButton)(interaction);
    }
    const safeEphemeralReply = async (content) => {
        // 3-second safety: ack first, then edit; fall back to reply/followUp.
        const deferred = await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).then(() => true, () => false);
        if (deferred) {
            await interaction.editReply({ content }).catch(() => { });
            return;
        }
        if (!interaction.replied) {
            await interaction.reply({ content, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
            return;
        }
        await interaction.followUp({ content, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    };
    if (id === ui_1.VOICE_PANEL_BALANCE_ID) {
        const bal = await (0, voicePoints_1.getBalance)(guildId, userId);
        await safeEphemeralReply(`Ваш баланс: **${bal}** баллов.`);
        return true;
    }
    const buy = id === ui_1.VOICE_PANEL_BUY_CONTRACT_PICK_ID
        ? { key: "contract_pick", ...GOODS.contract_pick }
        : id === ui_1.VOICE_PANEL_BUY_REMOVE_JAMB_ID
            ? { key: "remove_jamb", ...GOODS.remove_jamb }
            : null;
    if (!buy)
        return false;
    const res = await (0, voicePoints_1.subtractBalanceIfEnough)(guildId, userId, buy.cost);
    if (!res.ok) {
        await safeEphemeralReply(`Недостаточно баллов. Нужно **${buy.cost}**, у вас **${res.balance}**.`);
        return true;
    }
    await safeEphemeralReply(`Покупка: **${buy.label}** за **${buy.cost}** баллов.\nОстаток: **${res.balance}**.`);
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
            const me = textLog.guild?.members?.me ?? (await textLog.guild.members.fetchMe().catch(() => null));
            const perms = me ? textLog.permissionsFor(me) : null;
            if (!perms?.has(["ViewChannel", "SendMessages"])) {
                console.warn(`[voicePoints:log] Missing permissions in log channel ${textLog.id}: need ViewChannel + SendMessages`);
            }
            else {
                await textLog
                    .send({
                    content: `Покупка (voice points): <@${userId}> купил(а) **${buy.label}** за **${buy.cost}** баллов. Остаток: **${res.balance}**.`,
                    allowedMentions: { users: [userId] },
                })
                    .catch((e) => console.warn("[voicePoints:log] Failed to send purchase log:", e));
            }
        }
    }
    else {
        console.log("[voicePoints:log] VOICE_POINTS_LOG_CHANNEL_ID not set; skipping purchase log");
    }
    return true;
}
