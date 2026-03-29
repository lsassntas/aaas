"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLICATION_MODAL_CUSTOM_ID = exports.PANEL_APPLY_CUSTOM_ID = void 0;
exports.applicationModal = applicationModal;
exports.panelApplyButton = panelApplyButton;
exports.reviewButtons = reviewButtons;
exports.reviewEmbed = reviewEmbed;
const discord_js_1 = require("discord.js");
exports.PANEL_APPLY_CUSTOM_ID = "family:apply";
exports.APPLICATION_MODAL_CUSTOM_ID = "family:applicationModal";
function applicationModal(formDefaults) {
    const modal = new discord_js_1.ModalBuilder().setCustomId(exports.APPLICATION_MODAL_CUSTOM_ID).setTitle("Заявка в семью");
    const nickLevelAge = new discord_js_1.TextInputBuilder()
        .setCustomId("nick_level_age")
        .setLabel("Никнейм в игре (уровень) + ваш возраст ИРЛ")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setValue(formDefaults?.nickLevelAge ?? "");
    const projectPlayTime = new discord_js_1.TextInputBuilder()
        .setCustomId("project_play_time")
        .setLabel("Сколько играете на проекте")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(200)
        .setRequired(true)
        .setValue(formDefaults?.projectPlayTime ?? "");
    const previousFamilies = new discord_js_1.TextInputBuilder()
        .setCustomId("previous_families")
        .setLabel("Были ли в семьях? (если да, то каких)")
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setValue(formDefaults?.previousFamilies ?? "");
    const damageDm10 = new discord_js_1.TextInputBuilder()
        .setCustomId("damage_dm10")
        .setLabel("Ваши результаты по урону на ДМ 10 минут")
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setValue(formDefaults?.damageDm10 ?? "");
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(nickLevelAge), new discord_js_1.ActionRowBuilder().addComponents(projectPlayTime), new discord_js_1.ActionRowBuilder().addComponents(previousFamilies), new discord_js_1.ActionRowBuilder().addComponents(damageDm10));
    return modal;
}
function panelApplyButton() {
    return new discord_js_1.ButtonBuilder().setCustomId(exports.PANEL_APPLY_CUSTOM_ID).setLabel("Подача заявки").setStyle(discord_js_1.ButtonStyle.Primary);
}
function reviewButtons(applicationId, disabled) {
    const mk = (id) => new discord_js_1.ButtonBuilder()
        .setCustomId(`family:review:${id}:${applicationId}`)
        .setStyle(id === "accept"
        ? discord_js_1.ButtonStyle.Success
        : id === "reject"
            ? discord_js_1.ButtonStyle.Danger
            : discord_js_1.ButtonStyle.Secondary)
        .setLabel(id === "accept"
        ? "Принять"
        : id === "reject"
            ? "Отклонить"
            : id === "review"
                ? "Взять на рассмотрение"
                : "Вызвать на обзор")
        .setDisabled(disabled);
    return {
        row: new discord_js_1.ActionRowBuilder().addComponents(mk("accept"), mk("review"), mk("review_call"), mk("reject")),
    };
}
function reviewEmbed(payload) {
    const decidedAt = payload.decidedAtIso ? new Date(payload.decidedAtIso) : null;
    const decidedAtTs = decidedAt ? Math.floor(decidedAt.getTime() / 1000) : null;
    return new discord_js_1.EmbedBuilder()
        .setTitle("Заявка на вступление в семью")
        .setColor(0x5865f2)
        .addFields({ name: "Кто подал", value: payload.authorTag ? payload.authorTag : "—", inline: false }, { name: "Ник / уровень / возраст ИРЛ", value: payload.nickLevelAge, inline: false }, { name: "Сколько играете на проекте", value: payload.projectPlayTime, inline: false }, { name: "Были ли в семьях", value: payload.previousFamilies, inline: false }, { name: "Результаты по урону (ДМ 10 минут)", value: payload.damageDm10, inline: false }, ...(payload.decidedByTag
        ? [
            {
                name: "Кто принял решение",
                value: decidedAtTs ? `${payload.decidedByTag}\n<t:${decidedAtTs}:f>` : payload.decidedByTag,
                inline: false,
            },
        ]
        : []))
        .setFooter({ text: `ApplicationId: ${payload.applicationId} • ${payload.statusText}` });
}
