import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { VOICE_PANEL_GRANT_ID } from "./grant";

export const VOICE_PANEL_BALANCE_ID = "voice:balance";
export const VOICE_PANEL_BUY_CONTRACT_PICK_ID = "voice:buy:contract_pick";
export const VOICE_PANEL_BUY_REMOVE_JAMB_ID = "voice:buy:remove_jamb";

export function voicePointsEmbed() {
  return new EmbedBuilder()
    .setTitle("Баллы за войс — FENIMORE")
    .setColor(0x2b2d31)
    .setDescription(
      [
        "Копите баллы, находясь в голосовом канале (без mute/deaf, не в AFK-канале сервера).",
        "",
        "- **Мой баланс** — нажмите, ответ придёт только вам.",
        "- **Пик контракта — 150 баллов** (ответ только вам)",
        "- **Снятие косяка — 250 баллов** (ответ только вам)",
        "",
        "Цены и ответы на покупки видите только вы; при настроенном лог-канале покупка фиксируется для модерации.",
        "",
        "FENIMORE",
      ].join("\n"),
    );
}

export function voicePointsButtons() {
  const balance = new ButtonBuilder().setCustomId(VOICE_PANEL_BALANCE_ID).setLabel("Мой баланс").setStyle(ButtonStyle.Secondary);
  const contractPick = new ButtonBuilder()
    .setCustomId(VOICE_PANEL_BUY_CONTRACT_PICK_ID)
    .setLabel("Пик контракта (150)")
    .setStyle(ButtonStyle.Primary);
  const removeJamb = new ButtonBuilder()
    .setCustomId(VOICE_PANEL_BUY_REMOVE_JAMB_ID)
    .setLabel("Снятие косяка (250)")
    .setStyle(ButtonStyle.Success);
  const grant = new ButtonBuilder().setCustomId(VOICE_PANEL_GRANT_ID).setLabel("Выдать баллы").setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(balance, contractPick, removeJamb, grant);
}

