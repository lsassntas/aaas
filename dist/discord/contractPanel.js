"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractPanel = createContractPanel;
exports.handleContractButton = handleContractButton;
const discord_js_1 = require("discord.js");
const voicePoints_1 = require("../storage/voicePoints");
const contractRoster_1 = require("../storage/contractRoster");
const CONTRACT_COST = 150;
const JOIN_PREFIX = "contract:j:";
const LEAVE_PREFIX = "contract:l:";
function listJoined(userIds) {
    if (userIds.length === 0)
        return "— пока никто не записался —";
    return userIds.map((id, i) => `${i + 1}. <@${id}>`).join("\n");
}
function contractEmbed(state) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("Контракт")
        .setDescription("Записатся в контракт и снять 150 балов")
        .addFields({
        name: `Список записавшихся (${state.joinedUserIds.length})`,
        value: listJoined(state.joinedUserIds),
        inline: false,
    });
}
function contractButtons(messageId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`${JOIN_PREFIX}${messageId}`).setLabel("Записаться в контракт").setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`${LEAVE_PREFIX}${messageId}`).setLabel("Выйти из контракта").setStyle(discord_js_1.ButtonStyle.Danger));
}
async function refreshMessage(interaction, state) {
    await (0, contractRoster_1.upsertContractRosterRecord)(state);
    await interaction.message.edit({
        embeds: [contractEmbed(state)],
        components: [contractButtons(state.messageId)],
        allowedMentions: { users: [] },
    });
}
async function createContractPanel(interaction) {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: "Только на сервере.", flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const channel = interaction.channel;
    if (!channel?.isTextBased()) {
        await interaction.reply({ content: "Команда работает только в текстовом канале.", flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    await interaction.reply({
        content: "Контракт",
        embeds: [
            contractEmbed({
                messageId: "pending",
                channelId: channel.id,
                guildId: guild.id,
                joinedUserIds: [],
                cost: CONTRACT_COST,
            }),
        ],
        allowedMentions: { users: [] },
        fetchReply: true,
    });
    const msg = await interaction.fetchReply();
    const state = {
        messageId: msg.id,
        channelId: channel.id,
        guildId: guild.id,
        joinedUserIds: [],
        cost: CONTRACT_COST,
    };
    await (0, contractRoster_1.upsertContractRosterRecord)(state);
    await msg.edit({
        content: "Контракт",
        embeds: [contractEmbed(state)],
        components: [contractButtons(state.messageId)],
        allowedMentions: { users: [] },
    });
}
async function handleContractButton(interaction) {
    const id = interaction.customId;
    const isJoin = id.startsWith(JOIN_PREFIX);
    const isLeave = id.startsWith(LEAVE_PREFIX);
    if (!isJoin && !isLeave)
        return false;
    const messageId = id.slice((isJoin ? JOIN_PREFIX : LEAVE_PREFIX).length);
    if (!/^\d+$/.test(messageId))
        return true;
    await interaction.deferUpdate().catch(() => { });
    const result = await (0, contractRoster_1.withContractLock)(messageId, async () => {
        const state = await (0, contractRoster_1.getContractRosterRecord)(messageId);
        if (!state)
            return { error: "Эта панель устарела или удалена." };
        if (!interaction.guild || interaction.guild.id !== state.guildId)
            return { error: "Неверный сервер." };
        const uid = interaction.user.id;
        if (isJoin) {
            if (state.joinedUserIds.includes(uid))
                return { error: "Вы уже записаны в контракт." };
            const debit = await (0, voicePoints_1.subtractBalanceIfEnough)(state.guildId, uid, state.cost);
            if (!debit.ok)
                return { error: `Недостаточно баллов. Нужно **${state.cost}**, у вас **${debit.balance}**.` };
            state.joinedUserIds.push(uid);
            await refreshMessage(interaction, state);
            return { ok: `Вы записались в контракт. Списано **${state.cost}** баллов. Остаток: **${debit.balance}**.` };
        }
        if (!state.joinedUserIds.includes(uid))
            return { error: "Вы не записаны в контракт." };
        state.joinedUserIds = state.joinedUserIds.filter((x) => x !== uid);
        const balance = await (0, voicePoints_1.addBalance)(state.guildId, uid, state.cost);
        await refreshMessage(interaction, state);
        return { ok: `Вы вышли из контракта. Возвращено **${state.cost}** баллов. Баланс: **${balance}**.` };
    });
    if ("error" in result) {
        await interaction.followUp({ content: result.error, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    }
    else {
        await interaction.followUp({ content: result.ok, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    }
    return true;
}
