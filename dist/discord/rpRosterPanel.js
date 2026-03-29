"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRosterEmbed = buildRosterEmbed;
exports.buildRosterRows = buildRosterRows;
exports.postRosterPanelToChannel = postRosterPanelToChannel;
exports.createRosterPanel = createRosterPanel;
exports.handleRpRosterButton = handleRpRosterButton;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const rpRoster_1 = require("../storage/rpRoster");
const RP_EMBED_COLOR = 0x71368a;
const PREFIX_MAIN = "rp:m:";
const PREFIX_SUB = "rp:s:";
const PREFIX_LEAVE = "rp:x:";
const PREFIX_TOGGLE = "rp:t:";
const PREFIX_RK = "rp:r:";
function parseMessageId(customId, prefix) {
    if (!customId.startsWith(prefix))
        return null;
    const id = customId.slice(prefix.length);
    return /^\d+$/.test(id) ? id : null;
}
async function isModerator(member) {
    const ids = config_1.config.MODERATOR_ROLE_IDS ?? [];
    if (ids.length === 0)
        return false;
    return ids.some((roleId) => member.roles.cache.has(roleId));
}
function embedTitle(kind, postavkaNomer) {
    if (kind === "postavka" && postavkaNomer != null)
        return `Поставка — слот ${postavkaNomer}`;
    return "ВЗХ";
}
function listLinesMain(userIds) {
    if (userIds.length === 0)
        return "— пусто —";
    return userIds
        .map((id, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
        return `${medal} ⏬ <@${id}>`;
    })
        .join("\n");
}
function listLinesSub(userIds) {
    if (userIds.length === 0)
        return "— пусто —";
    return userIds.map((id) => `👤 <@${id}>`).join("\n");
}
function listLinesRk(userIds) {
    if (userIds.length === 0)
        return "— пусто —";
    return userIds.map((id) => `⚔️ <@${id}>`).join("\n");
}
function buildRosterEmbed(state) {
    const mainCap = state.mainMax;
    const subCapLabel = state.subMax == null ? "∞" : String(state.subMax);
    const fields = [
        {
            name: `Основной список (${state.mainUserIds.length}/${mainCap})`,
            value: listLinesMain(state.mainUserIds),
            inline: false,
        },
        {
            name: `На замене (${state.subUserIds.length}/${subCapLabel})`,
            value: listLinesSub(state.subUserIds),
            inline: false,
        },
    ];
    if (state.kind === "vzh" && state.rkMax != null) {
        fields.push({
            name: `РК (${state.rkUserIds.length}/${state.rkMax})`,
            value: listLinesRk(state.rkUserIds),
            inline: false,
        });
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(RP_EMBED_COLOR)
        .setTitle(embedTitle(state.kind, state.postavkaNomer))
        .addFields(fields)
        .setFooter({
        text: `${state.open ? "🔓" : "🔒"} ${state.open ? "Список открыт" : "Список закрыт"}`,
    });
    if (state.kind === "vzh") {
        embed.setDescription("**30** в основу · до **5** в заменах · **2** места **РК** (отдельная кнопка).");
    }
    return embed;
}
function buildRosterRows(state) {
    const mid = state.messageId;
    const row1comps = [
        new discord_js_1.ButtonBuilder()
            .setCustomId(`${PREFIX_MAIN}${mid}`)
            .setLabel("В основу")
            .setStyle(discord_js_1.ButtonStyle.Success),
        new discord_js_1.ButtonBuilder()
            .setCustomId(`${PREFIX_SUB}${mid}`)
            .setLabel(state.kind === "vzh" ? "В замену" : "В замены")
            .setStyle(discord_js_1.ButtonStyle.Primary),
    ];
    if (state.kind === "vzh" && state.rkMax != null) {
        row1comps.push(new discord_js_1.ButtonBuilder()
            .setCustomId(`${PREFIX_RK}${mid}`)
            .setLabel("В РК")
            .setStyle(discord_js_1.ButtonStyle.Primary));
    }
    row1comps.push(new discord_js_1.ButtonBuilder()
        .setCustomId(`${PREFIX_LEAVE}${mid}`)
        .setLabel("Выйти")
        .setStyle(discord_js_1.ButtonStyle.Danger));
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(row1comps);
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`${PREFIX_TOGGLE}${mid}`)
        .setLabel(state.open ? "Закрыть список" : "Открыть список")
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    return [row1, row2];
}
async function persistAndRefresh(interaction, state) {
    await (0, rpRoster_1.upsertRosterRecord)(state);
    const embed = buildRosterEmbed(state);
    const rows = buildRosterRows(state);
    await interaction.message.edit({ embeds: [embed], components: rows });
}
function rosterDraft(guildId, channelId, params) {
    const isVzh = params.kind === "vzh";
    return {
        channelId,
        guildId,
        kind: params.kind,
        postavkaNomer: params.postavkaNomer,
        mainMax: params.mainMax,
        subMax: params.subMax,
        mainUserIds: [],
        subUserIds: [],
        rkUserIds: [],
        rkMax: isVzh ? 2 : null,
        open: true,
    };
}
async function bindRosterToDiscordMessage(msg, draft) {
    const ready = { ...draft, messageId: msg.id };
    await (0, rpRoster_1.upsertRosterRecord)(ready);
    await msg.edit({
        content: "РП / GTA 5 RP",
        embeds: [buildRosterEmbed(ready)],
        components: buildRosterRows(ready),
    });
}
/** Создать панель из обычного сообщения в канале (например, текстом `/postavka 25`). */
async function postRosterPanelToChannel(channel, params) {
    const guild = channel.guild;
    const draft = rosterDraft(guild.id, channel.id, params);
    const embed = buildRosterEmbed({ ...draft, messageId: "pending" });
    const msg = await channel.send({
        content: "РП / GTA 5 RP",
        embeds: [embed],
        allowedMentions: { users: [] },
    });
    await bindRosterToDiscordMessage(msg, draft);
}
async function createRosterPanel(interaction, params) {
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
    const draft = rosterDraft(guild.id, channel.id, params);
    const embed = buildRosterEmbed({ ...draft, messageId: "pending" });
    await interaction.reply({
        content: "РП / GTA 5 RP",
        embeds: [embed],
        allowedMentions: { users: [] },
        fetchReply: true,
    });
    const msg = await interaction.fetchReply();
    await bindRosterToDiscordMessage(msg, draft);
}
function subHasRoom(state) {
    if (state.subMax == null)
        return true;
    return state.subUserIds.length < state.subMax;
}
function removeUserEverywhere(state, userId) {
    state.mainUserIds = state.mainUserIds.filter((id) => id !== userId);
    state.subUserIds = state.subUserIds.filter((id) => id !== userId);
    state.rkUserIds = state.rkUserIds.filter((id) => id !== userId);
}
function rkHasRoom(state) {
    if (state.rkMax == null)
        return false;
    return state.rkUserIds.length < state.rkMax;
}
async function handleRpRosterButton(interaction) {
    const id = interaction.customId;
    let messageId = null;
    let mode = null;
    if (id.startsWith(PREFIX_MAIN)) {
        mode = "main";
        messageId = parseMessageId(id, PREFIX_MAIN);
    }
    else if (id.startsWith(PREFIX_SUB)) {
        mode = "sub";
        messageId = parseMessageId(id, PREFIX_SUB);
    }
    else if (id.startsWith(PREFIX_RK)) {
        mode = "rk";
        messageId = parseMessageId(id, PREFIX_RK);
    }
    else if (id.startsWith(PREFIX_LEAVE)) {
        mode = "leave";
        messageId = parseMessageId(id, PREFIX_LEAVE);
    }
    else if (id.startsWith(PREFIX_TOGGLE)) {
        mode = "toggle";
        messageId = parseMessageId(id, PREFIX_TOGGLE);
    }
    if (!messageId || !mode)
        return false;
    await interaction.deferUpdate().catch(() => { });
    const result = await (0, rpRoster_1.withRpRosterLock)(messageId, async () => {
        const record = await (0, rpRoster_1.getRosterRecord)(messageId);
        if (!record) {
            return { error: "Этот список устарел или удалён." };
        }
        const guild = interaction.guild;
        if (!guild || guild.id !== record.guildId) {
            return { error: "Неверный сервер." };
        }
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (mode === "toggle") {
            if (!member || !(await isModerator(member))) {
                return { error: "Закрывать и открывать список могут только модераторы." };
            }
            record.open = !record.open;
            await (0, rpRoster_1.upsertRosterRecord)(record);
            await interaction.message.edit({ embeds: [buildRosterEmbed(record)], components: buildRosterRows(record) });
            return { ok: true };
        }
        if (!record.open) {
            return { error: "Список закрыт. Запись недоступна." };
        }
        const uid = interaction.user.id;
        if (mode === "leave") {
            removeUserEverywhere(record, uid);
            await persistAndRefresh(interaction, record);
            return { ok: true };
        }
        if (mode === "main") {
            const inMain = record.mainUserIds.includes(uid);
            const inSub = record.subUserIds.includes(uid);
            if (inMain) {
                return { error: "Вы уже в основном списке." };
            }
            if (record.mainUserIds.length >= record.mainMax) {
                return { error: "Основной список заполнен." };
            }
            removeUserEverywhere(record, uid);
            if (inSub) {
                /* place freed in sub */
            }
            record.mainUserIds.push(uid);
            await persistAndRefresh(interaction, record);
            return { ok: true };
        }
        if (mode === "sub") {
            const inSub = record.subUserIds.includes(uid);
            if (inSub) {
                return { error: "Вы уже в списке замен." };
            }
            if (!subHasRoom(record)) {
                return { error: "Список замен заполнен." };
            }
            removeUserEverywhere(record, uid);
            record.subUserIds.push(uid);
            await persistAndRefresh(interaction, record);
            return { ok: true };
        }
        if (mode === "rk") {
            if (record.kind !== "vzh" || record.rkMax == null) {
                return { error: "РК доступно только для списка ВЗХ." };
            }
            if (record.rkUserIds.includes(uid)) {
                return { error: "Вы уже в списке РК." };
            }
            if (!rkHasRoom(record)) {
                return { error: "Список РК заполнен (максимум 2 человека)." };
            }
            removeUserEverywhere(record, uid);
            record.rkUserIds.push(uid);
            await persistAndRefresh(interaction, record);
            return { ok: true };
        }
        return { error: "Неизвестное действие." };
    });
    if ("error" in result && result.error) {
        await interaction.followUp({ content: result.error, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    }
    return true;
}
