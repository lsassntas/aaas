"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AFK_ENTER_MODAL_ID = exports.AFK_EXIT_BUTTON_ID = exports.AFK_ENTER_BUTTON_ID = void 0;
exports.afkEmbed = afkEmbed;
exports.afkButtons = afkButtons;
exports.afkEnterModal = afkEnterModal;
const discord_js_1 = require("discord.js");
exports.AFK_ENTER_BUTTON_ID = "afk:enter";
exports.AFK_EXIT_BUTTON_ID = "afk:exit";
exports.AFK_ENTER_MODAL_ID = "afk:enterModal";
function afkEmbed(lines) {
    const listText = lines.length > 0 ? lines.join("\n") : "Список пользователей в АФК пуст";
    return new discord_js_1.EmbedBuilder()
        .setTitle("Список АФК")
        .setColor(0x2b2d31)
        .setDescription(["📋 Используйте кнопки ниже для управления АФК статусом", "", listText].join("\n"))
        .setTimestamp(new Date());
}
function afkButtons() {
    const enter = new discord_js_1.ButtonBuilder().setCustomId(exports.AFK_ENTER_BUTTON_ID).setLabel("Встать в АФК").setStyle(discord_js_1.ButtonStyle.Success);
    const exit = new discord_js_1.ButtonBuilder().setCustomId(exports.AFK_EXIT_BUTTON_ID).setLabel("Выйти с АФК").setStyle(discord_js_1.ButtonStyle.Danger);
    return new discord_js_1.ActionRowBuilder().addComponents(enter, exit);
}
function afkEnterModal() {
    const modal = new discord_js_1.ModalBuilder().setCustomId(exports.AFK_ENTER_MODAL_ID).setTitle("Встать в АФК");
    const reason = new discord_js_1.TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Причина")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(200)
        .setRequired(true)
        .setPlaceholder("Причина ухода в АФК");
    const time = new discord_js_1.TextInputBuilder()
        .setCustomId("time")
        .setLabel("Время в АФК (часы:минуты)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("1:23 ... максимум 12:00");
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(reason), new discord_js_1.ActionRowBuilder().addComponents(time));
    return modal;
}
