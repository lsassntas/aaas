import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

export const AFK_ENTER_BUTTON_ID = "afk:enter";
export const AFK_EXIT_BUTTON_ID = "afk:exit";
export const AFK_ENTER_MODAL_ID = "afk:enterModal";

export function afkEmbed(lines: string[]) {
  const listText = lines.length > 0 ? lines.join("\n") : "Список пользователей в АФК пуст";

  return new EmbedBuilder()
    .setTitle("Список АФК")
    .setColor(0x2b2d31)
    .setDescription(["📋 Используйте кнопки ниже для управления АФК статусом", "", listText].join("\n"))
    .setTimestamp(new Date());
}

export function afkButtons() {
  const enter = new ButtonBuilder().setCustomId(AFK_ENTER_BUTTON_ID).setLabel("Встать в АФК").setStyle(ButtonStyle.Success);
  const exit = new ButtonBuilder().setCustomId(AFK_EXIT_BUTTON_ID).setLabel("Выйти с АФК").setStyle(ButtonStyle.Danger);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(enter, exit);
}

export function afkEnterModal() {
  const modal = new ModalBuilder().setCustomId(AFK_ENTER_MODAL_ID).setTitle("Встать в АФК");

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Причина")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true)
    .setPlaceholder("Причина ухода в АФК");

  const time = new TextInputBuilder()
    .setCustomId("time")
    .setLabel("Время в АФК (часы:минуты)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("1:23 ... максимум 12:00");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
    new ActionRowBuilder<TextInputBuilder>().addComponents(time),
  );

  return modal;
}

