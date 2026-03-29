"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPanelButtonIfMissing = registerPanelButtonIfMissing;
exports.handleInteraction = handleInteraction;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const ui_1 = require("./ui");
const applications_1 = require("../storage/applications");
const mapping_1 = require("../storage/mapping");
const handlers_1 = require("../voicePoints/handlers");
const grant_1 = require("../voicePoints/grant");
const handlers_2 = require("../afk/handlers");
const weeklyTickets_1 = require("../storage/weeklyTickets");
const broadcastDm_1 = require("./broadcastDm");
const rpCommands_1 = require("./rpCommands");
const rpRosterPanel_1 = require("./rpRosterPanel");
const folderLock = new Map();
async function withFolderLock(key, fn) {
    const prev = folderLock.get(key) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => (release = res));
    folderLock.set(key, prev.then(() => next));
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
        // best-effort cleanup
        if (folderLock.get(key))
            folderLock.delete(key);
    }
}
async function isModerator(member) {
    const ids = config_1.config.MODERATOR_ROLE_IDS ?? [];
    if (ids.length === 0)
        return false;
    return ids.some((id) => member.roles.cache.has(id));
}
function getTextInputValue(modal, id) {
    const v = modal.fields.getTextInputValue(id);
    return v?.trim() ?? "";
}
function sanitizeForChannelName(nickLevelAge, applicationId) {
    // Discord channel names allow letters/digits/hyphen. We'll be conservative.
    const nick = nickLevelAge
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const prefix = nick.slice(0, 20) || "zayavka";
    const suffix = applicationId.slice(0, 8);
    return `zayavka-${prefix}-${suffix}`;
}
async function registerPanelButtonIfMissing(client) {
    // Отправляем панель-кнопку в PANEL_CHANNEL_ID, если бота ещё не настроили вручную.
    const panelMessageText = "**Заявки в семью.**\n" +
        "**Путь в семью начинается здесь!**\n\n" +
        "**Уведомление о приглашении на обзвон обычно отправляется в личные сообщения.**\n\n" +
        "**Обычно заявки обрабатываются в течение 1–7 дней — всё зависит от того, насколько загружены наши рекрутеры на данный момент.**\n\n" +
        "**Подать заявку можно только при открытом наборе. Если не выходит — набор закрыт. Внимательно прочтите сообщение ниже.**";
    const channel = await client.channels.fetch(config_1.config.PANEL_CHANNEL_ID);
    if (!channel || !channel.isTextBased())
        return;
    const textChannel = channel;
    const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
    const perms = me ? textChannel.permissionsFor(me) : null;
    if (!perms?.has([discord_js_1.PermissionsBitField.Flags.ViewChannel, discord_js_1.PermissionsBitField.Flags.SendMessages])) {
        console.warn(`[panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages. Set PANEL_CHANNEL_ID to a channel where the bot can write.`);
        return;
    }
    const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (recent) {
        for (const m of recent.values()) {
            // Use loose typing here; component types differ between API versions.
            const rows = m.components ?? [];
            for (const row of rows) {
                const comps = row?.components ?? [];
                for (const comp of comps) {
                    if (comp?.customId === ui_1.PANEL_APPLY_CUSTOM_ID) {
                        // Если кнопка уже есть, обновим только текст сообщения.
                        await m.edit({ content: panelMessageText }).catch(() => { });
                        return;
                    }
                }
            }
        }
    }
    const row = new discord_js_1.ActionRowBuilder().addComponents((0, ui_1.panelApplyButton)());
    await textChannel.send({ components: [row], content: panelMessageText }).catch((e) => {
        if (e?.code === 50013) {
            console.warn(`[panel] DiscordAPIError 50013 Missing Permissions while sending to ${textChannel.id}. Check bot permissions.`);
            return;
        }
        throw e;
    });
}
async function handleInteraction(interaction) {
    try {
        if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
            const handledRp = await (0, rpCommands_1.handleRpSlashCommand)(interaction);
            if (handledRp)
                return;
            const handledDm = await (0, broadcastDm_1.handleRassylkaSlashCommand)(interaction);
            if (handledDm)
                return;
        }
        if (interaction.isButton()) {
            return await handleButton(interaction);
        }
        if (interaction.isModalSubmit()) {
            const modal = interaction;
            if (modal.customId.startsWith("voice:")) {
                const handled = await (0, grant_1.handleGrantModal)(modal);
                if (handled)
                    return;
            }
            if (modal.customId.startsWith("afk:")) {
                const handled = await (0, handlers_2.handleAfkModal)(modal);
                if (handled)
                    return;
            }
            return await handleModalSubmit(modal);
        }
    }
    catch (e) {
        const anyErr = e;
        const code = anyErr?.code;
        // Common transient case: interaction expired or Discord API timed out.
        if (code === 10062 || code === "UND_ERR_CONNECT_TIMEOUT" || anyErr?.name === "ConnectTimeoutError")
            return;
        console.error(e);
        if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Ошибка при обработке запроса.", flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        }
    }
}
async function ensureRecordFolderLink(applicationId, folderName, discordChannelId, reviewMessageId, discordUserId, nickFromForm, form) {
    const record = (0, applications_1.buildRecord)({
        applicationId,
        folderName,
        discordChannelId,
        reviewMessageId,
        discordUserId,
        nickFromForm,
        form,
        status: "submitted",
    });
    await (0, mapping_1.upsertApplication)(record);
    return record;
}
async function handleButton(interaction) {
    const customId = interaction.customId;
    if (customId.startsWith("rp:m:") ||
        customId.startsWith("rp:s:") ||
        customId.startsWith("rp:r:") ||
        customId.startsWith("rp:x:") ||
        customId.startsWith("rp:t:")) {
        const handled = await (0, rpRosterPanel_1.handleRpRosterButton)(interaction);
        if (handled)
            return;
    }
    if (customId.startsWith("voice:")) {
        const handled = await (0, handlers_1.handleVoicePointsButton)(interaction);
        if (handled)
            return;
    }
    if (customId.startsWith("afk:")) {
        const handled = await (0, handlers_2.handleAfkButton)(interaction);
        if (handled)
            return;
    }
    if (customId === ui_1.PANEL_APPLY_CUSTOM_ID) {
        try {
            await interaction.showModal((0, ui_1.applicationModal)());
        }
        catch (e) {
            // If Discord API is timing out / interaction already expired, there's nothing we can do.
            const code = e?.code;
            if (code === 10062 || code === "UND_ERR_CONNECT_TIMEOUT" || e?.name === "ConnectTimeoutError")
                return;
            throw e;
        }
        return;
    }
    // Review actions: family:review:<action>:<applicationId>
    if (customId.startsWith("family:review:")) {
        const [, , action, applicationId] = customId.split(":");
        if (!applicationId)
            return;
        const guild = interaction.guild;
        if (!guild)
            return;
        // Acknowledge immediately to avoid "Unknown interaction" on slow API / disk / network.
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !(await isModerator(member))) {
            await interaction.editReply({ content: "У вас нет прав для принятия заявок." }).catch(() => { });
            return;
        }
        const record = await (0, mapping_1.getApplication)(applicationId);
        if (!record) {
            await interaction.editReply({ content: "Заявка не найдена." }).catch(() => { });
            return;
        }
        if (record.status === "accepted" || record.status === "rejected") {
            await interaction.editReply({ content: "Эта заявка уже обработана." }).catch(() => { });
            return;
        }
        const decisionStatus = action === "accept"
            ? "accepted"
            : action === "reject"
                ? "rejected"
                : action === "review_call"
                    ? "in_reviewing"
                    : "in_review";
        const folderKey = record.folderName;
        // DM applicant when moderator "Вызвать на обзор"
        if (action === "review_call") {
            const applicantId = record.discordUserId;
            try {
                const applicant = await interaction.client.users.fetch(applicantId);
                await applicant.send("Вы вызваны на обзвон.");
            }
            catch (e) {
                // If user disabled DMs, don't block the moderation action.
                console.warn(`Failed to DM user ${applicantId}:`, e);
            }
        }
        await withFolderLock(folderKey, async () => {
            if (action === "accept" || action === "reject") {
                await (0, weeklyTickets_1.appendWeeklyTicketEvent)({
                    guildId: interaction.guild.id,
                    moderatorUserId: interaction.user.id,
                    applicationId: record.applicationId,
                    decision: action === "accept" ? "accepted" : "rejected",
                    atIso: new Date().toISOString(),
                }).catch(() => { });
                await (0, applications_1.deleteApplicationFolder)(record.folderName);
                await (0, mapping_1.deleteApplication)(record.applicationId);
            }
            else {
                await (0, mapping_1.updateApplicationStatus)(record.applicationId, decisionStatus);
            }
        });
        // Disable buttons in the review message
        if (interaction.message && "edit" in interaction.message) {
            const finalDecision = action === "accept" || action === "reject";
            const buttons = (0, ui_1.reviewButtons)(record.applicationId, finalDecision);
            if (finalDecision) {
                const statusText = action === "accept" ? "Принято" : "Отклонено";
                const embed = (0, ui_1.reviewEmbed)({
                    nickLevelAge: record.form.nickLevelAge,
                    projectPlayTime: record.form.projectPlayTime,
                    previousFamilies: record.form.previousFamilies,
                    damageDm10: record.form.damageDm10,
                    authorTag: `<@${record.discordUserId}>`,
                    applicationId: record.applicationId,
                    statusText,
                    decidedByTag: `<@${interaction.user.id}>`,
                    decidedAtIso: new Date().toISOString(),
                });
                await interaction.message.edit({ components: [buttons.row], embeds: [embed] }).catch(() => { });
            }
            else {
                await interaction.message.edit({ components: [buttons.row] }).catch(() => { });
            }
        }
        // Log only on final decision
        if (action === "accept" || action === "reject") {
            // Delete the application Discord channel as well.
            try {
                const appChannel = await interaction.client.channels.fetch(record.discordChannelId).catch(() => null);
                if (appChannel?.isTextBased() && "delete" in appChannel) {
                    await appChannel.delete(`Заявка ${action === "accept" ? "принята" : "отклонена"}`);
                }
            }
            catch (e) {
                console.warn(`Failed to delete application channel ${record.discordChannelId}:`, e);
            }
            const logChannel = await interaction.client.channels.fetch(config_1.config.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const statusText = action === "accept" ? "Принято" : "Отклонено";
                const embed = (0, ui_1.reviewEmbed)({
                    nickLevelAge: record.form.nickLevelAge,
                    projectPlayTime: record.form.projectPlayTime,
                    previousFamilies: record.form.previousFamilies,
                    damageDm10: record.form.damageDm10,
                    authorTag: `<@${record.discordUserId}>`,
                    applicationId: record.applicationId,
                    statusText,
                    decidedByTag: `<@${interaction.user.id}>`,
                    decidedAtIso: new Date().toISOString(),
                }).setTitle("Лог заявки (модерация)");
                await logChannel.send({ embeds: [embed] });
            }
        }
        await interaction.editReply({ content: "Готово." }).catch(() => { });
    }
}
async function handleModalSubmit(interaction) {
    if (interaction.customId !== ui_1.APPLICATION_MODAL_CUSTOM_ID)
        return;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
    const nickLevelAge = getTextInputValue(interaction, "nick_level_age");
    const projectPlayTime = getTextInputValue(interaction, "project_play_time");
    const previousFamilies = getTextInputValue(interaction, "previous_families");
    const damageDm10 = getTextInputValue(interaction, "damage_dm10");
    const form = {
        nickLevelAge,
        projectPlayTime,
        previousFamilies,
        damageDm10,
    };
    await (0, mapping_1.ensureBaseDirectories)();
    const applicationId = (0, applications_1.generateApplicationId)();
    const applicationFolder = await (0, applications_1.createApplicationFolder)({
        applicationId,
        nickLevelAge,
        form,
    });
    const discordChannelName = sanitizeForChannelName(nickLevelAge, applicationId);
    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: "Заявка не может быть создана вне сервера." });
        return;
    }
    const category = await guild.channels.fetch(config_1.config.CATEGORY_ID).catch(() => null);
    if (!category || category.type !== discord_js_1.ChannelType.GuildCategory) {
        await interaction.editReply({ content: "Не найдена категория для заявок." });
        return;
    }
    const channel = await guild.channels
        .create({
        name: discordChannelName,
        type: discord_js_1.ChannelType.GuildText,
        parent: config_1.config.CATEGORY_ID,
        topic: `Заявка: ${nickLevelAge}`,
    })
        .catch(async (e) => {
        console.error(e);
        await interaction.editReply({ content: "Не удалось создать канал заявки." });
        return null;
    });
    if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: "Не удалось создать канал заявки." });
        return;
    }
    const disabled = false;
    const buttons = (0, ui_1.reviewButtons)(applicationId, disabled);
    const embed = (0, ui_1.reviewEmbed)({
        nickLevelAge,
        projectPlayTime,
        previousFamilies,
        damageDm10,
        authorTag: `<@${interaction.user.id}>`,
        applicationId,
        statusText: "В очереди на модерацию",
    });
    const reviewMessage = await channel.send({
        content: "Модераторы, обработайте заявку:",
        embeds: [embed],
        components: [buttons.row],
    });
    const record = await ensureRecordFolderLink(applicationId, applicationFolder.folderName, channel.id, reviewMessage.id, interaction.user.id, applicationFolder.nickFromForm, form);
    await interaction.editReply({ content: `Заявка создана. Канал: ${channel}` });
}
