import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ApplicationForm } from "../types";

export const PANEL_APPLY_CUSTOM_ID = "family:apply";
export const APPLICATION_MODAL_CUSTOM_ID = "family:applicationModal";

export function applicationModal(formDefaults?: Partial<ApplicationForm>) {
  const modal = new ModalBuilder().setCustomId(APPLICATION_MODAL_CUSTOM_ID).setTitle("Заявка в семью");

  const nickLevelAge = new TextInputBuilder()
    .setCustomId("nick_level_age")
    .setLabel("Никнейм в игре (уровень) + ваш возраст ИРЛ")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true)
    .setValue(formDefaults?.nickLevelAge ?? "");

  const projectPlayTime = new TextInputBuilder()
    .setCustomId("project_play_time")
    .setLabel("Сколько играете на проекте")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true)
    .setValue(formDefaults?.projectPlayTime ?? "");

  const previousFamilies = new TextInputBuilder()
    .setCustomId("previous_families")
    .setLabel("Были ли в семьях? (если да, то каких)")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true)
    .setValue(formDefaults?.previousFamilies ?? "");

  const damageDm10 = new TextInputBuilder()
    .setCustomId("damage_dm10")
    .setLabel("Ваши результаты по урону на ДМ 10 минут")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true)
    .setValue(formDefaults?.damageDm10 ?? "");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nickLevelAge),
    new ActionRowBuilder<TextInputBuilder>().addComponents(projectPlayTime),
    new ActionRowBuilder<TextInputBuilder>().addComponents(previousFamilies),
    new ActionRowBuilder<TextInputBuilder>().addComponents(damageDm10),
  );

  return modal;
}

export function panelApplyButton() {
  return new ButtonBuilder().setCustomId(PANEL_APPLY_CUSTOM_ID).setLabel("Подача заявки").setStyle(ButtonStyle.Primary);
}

export type ReviewAction = "accept" | "reject" | "review" | "review_call";

export function reviewButtons(applicationId: string, disabled: boolean) {
  const mk = (id: ReviewAction) =>
    new ButtonBuilder()
      .setCustomId(`family:review:${id}:${applicationId}`)
      .setStyle(
        id === "accept"
          ? ButtonStyle.Success
          : id === "reject"
            ? ButtonStyle.Danger
            : ButtonStyle.Secondary,
      )
      .setLabel(
        id === "accept"
          ? "Принять"
          : id === "reject"
            ? "Отклонить"
            : id === "review"
              ? "Взять на рассмотрение"
              : "Вызвать на обзор",
      )
      .setDisabled(disabled);

  return {
    row: new ActionRowBuilder<ButtonBuilder>().addComponents(mk("accept"), mk("review"), mk("review_call"), mk("reject")),
  };
}

export function reviewEmbed(payload: {
  nickLevelAge: string;
  projectPlayTime: string;
  previousFamilies: string;
  damageDm10: string;
  authorTag?: string;
  applicationId: string;
  statusText: string;
  decidedByTag?: string;
  decidedAtIso?: string;
}) {
  const decidedAt = payload.decidedAtIso ? new Date(payload.decidedAtIso) : null;
  const decidedAtTs = decidedAt ? Math.floor(decidedAt.getTime() / 1000) : null;

  return new EmbedBuilder()
    .setTitle("Заявка на вступление в семью")
    .setColor(0x5865f2)
    .addFields(
      { name: "Кто подал", value: payload.authorTag ? payload.authorTag : "—", inline: false },
      { name: "Ник / уровень / возраст ИРЛ", value: payload.nickLevelAge, inline: false },
      { name: "Сколько играете на проекте", value: payload.projectPlayTime, inline: false },
      { name: "Были ли в семьях", value: payload.previousFamilies, inline: false },
      { name: "Результаты по урону (ДМ 10 минут)", value: payload.damageDm10, inline: false },
      ...(payload.decidedByTag
        ? [
            {
              name: "Кто принял решение",
              value: decidedAtTs ? `${payload.decidedByTag}\n<t:${decidedAtTs}:f>` : payload.decidedByTag,
              inline: false,
            },
          ]
        : []),
    )
    .setFooter({ text: `ApplicationId: ${payload.applicationId} • ${payload.statusText}` });
}

