"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOICE_PANEL_BUY_REMOVE_JAMB_ID = exports.VOICE_PANEL_BUY_CONTRACT_PICK_ID = exports.VOICE_PANEL_BALANCE_ID = void 0;
exports.voicePointsEmbed = voicePointsEmbed;
exports.voicePointsButtons = voicePointsButtons;
const discord_js_1 = require("discord.js");
const grant_1 = require("./grant");
exports.VOICE_PANEL_BALANCE_ID = "voice:balance";
exports.VOICE_PANEL_BUY_CONTRACT_PICK_ID = "voice:buy:contract_pick";
exports.VOICE_PANEL_BUY_REMOVE_JAMB_ID = "voice:buy:remove_jamb";
function voicePointsEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setTitle("Баллы за войс — FENIMORE")
        .setColor(0x2b2d31)
        .setDescription([
        "Копите баллы, находясь в голосовом канале (без mute/deaf, не в AFK-канале сервера).",
        "",
        "- **Мой баланс** — нажмите, ответ придёт только вам.",
        "- **Пик контракта — 150 баллов** (ответ только вам)",
        "- **Снятие косяка — 250 баллов** (ответ только вам)",
        "",
        "Цены и ответы на покупки видите только вы; при настроенном лог-канале покупка фиксируется для модерации.",
        "",
        "FENIMORE",
    ].join("\n"));
}
function voicePointsButtons() {
    const balance = new discord_js_1.ButtonBuilder().setCustomId(exports.VOICE_PANEL_BALANCE_ID).setLabel("Мой баланс").setStyle(discord_js_1.ButtonStyle.Secondary);
    const contractPick = new discord_js_1.ButtonBuilder()
        .setCustomId(exports.VOICE_PANEL_BUY_CONTRACT_PICK_ID)
        .setLabel("Пик контракта (150)")
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const removeJamb = new discord_js_1.ButtonBuilder()
        .setCustomId(exports.VOICE_PANEL_BUY_REMOVE_JAMB_ID)
        .setLabel("Снятие косяка (250)")
        .setStyle(discord_js_1.ButtonStyle.Success);
    const grant = new discord_js_1.ButtonBuilder().setCustomId(grant_1.VOICE_PANEL_GRANT_ID).setLabel("Выдать баллы").setStyle(discord_js_1.ButtonStyle.Secondary);
    return new discord_js_1.ActionRowBuilder().addComponents(balance, contractPick, removeJamb, grant);
}
