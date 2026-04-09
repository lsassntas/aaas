import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { config } from "../config";
import {
  getRosterRecord,
  type RosterKind,
  type RosterRecord,
  upsertRosterRecord,
  withRpRosterLock,
} from "../storage/rpRoster";
import { addBalance } from "../storage/voicePoints";

const RP_EMBED_COLOR = 0x71368a;

const PREFIX_MAIN = "rp:m:";
const PREFIX_SUB = "rp:s:";
const PREFIX_LEAVE = "rp:x:";
const PREFIX_TOGGLE = "rp:t:";
const PREFIX_RK = "rp:r:";
const PREFIX_GRANT_MAIN = "rp:g:";
const GRANT_MAIN_MODAL_PREFIX = "rp:grantmain:";

function parseMessageId(customId: string, prefix: string): string | null {
  if (!customId.startsWith(prefix)) return null;
  const id = customId.slice(prefix.length);
  return /^\d+$/.test(id) ? id : null;
}

async function isModerator(member: GuildMember): Promise<boolean> {
  const ids = config.MODERATOR_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((roleId) => member.roles.cache.has(roleId));
}

function embedTitle(kind: RosterKind, postavkaNomer?: number): string {
  if (kind === "postavka" && postavkaNomer != null) return `Поставка — слот ${postavkaNomer}`;
  if (kind === "poezd") return "Поезд";
  return "ВЗХ";
}

function listLinesMain(userIds: string[]): string {
  if (userIds.length === 0) return "— пусто —";
  return userIds
    .map((id, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
      return `${medal} ⏬ <@${id}>`;
    })
    .join("\n");
}

function listLinesSub(userIds: string[]): string {
  if (userIds.length === 0) return "— пусто —";
  return userIds.map((id) => `👤 <@${id}>`).join("\n");
}

function listLinesRk(userIds: string[]): string {
  if (userIds.length === 0) return "— пусто —";
  return userIds.map((id) => `⚔️ <@${id}>`).join("\n");
}

export function buildRosterEmbed(state: RosterRecord): EmbedBuilder {
  const mainCap = state.mainMax;
  const fields: { name: string; value: string; inline: boolean }[] = [
    {
      name: `Основной список (${state.mainUserIds.length}/${mainCap})`,
      value: listLinesMain(state.mainUserIds),
      inline: false,
    },
  ];
  if (state.kind !== "poezd") {
    const subCapLabel = state.subMax == null ? "∞" : String(state.subMax);
    fields.push({
      name: `На замене (${state.subUserIds.length}/${subCapLabel})`,
      value: listLinesSub(state.subUserIds),
      inline: false,
    });
  }

  if (state.kind === "vzh" && state.rkMax != null) {
    fields.push({
      name: `РК (${state.rkUserIds.length}/${state.rkMax})`,
      value: listLinesRk(state.rkUserIds),
      inline: false,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(RP_EMBED_COLOR)
    .setTitle(embedTitle(state.kind, state.postavkaNomer))
    .addFields(fields)
    .setFooter({
      text: `${state.open ? "🔓" : "🔒"} ${state.open ? "Список открыт" : "Список закрыт"}`,
    });

  if (state.kind === "vzh") {
    embed.setDescription(
      "**30** в основу · до **5** в заменах · **2** места **РК** (отдельная кнопка).",
    );
  }

  return embed;
}

export function buildRosterRows(state: RosterRecord): ActionRowBuilder<ButtonBuilder>[] {
  const mid = state.messageId;
  const row1comps: ButtonBuilder[] = [new ButtonBuilder().setCustomId(`${PREFIX_MAIN}${mid}`).setLabel("В основу").setStyle(ButtonStyle.Success)];
  if (state.kind !== "poezd") {
    row1comps.push(
      new ButtonBuilder()
        .setCustomId(`${PREFIX_SUB}${mid}`)
        .setLabel(state.kind === "vzh" ? "В замену" : "В замены")
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (state.kind === "vzh" && state.rkMax != null) {
    row1comps.push(
      new ButtonBuilder()
        .setCustomId(`${PREFIX_RK}${mid}`)
        .setLabel("В РК")
        .setStyle(ButtonStyle.Primary),
    );
  }
  row1comps.push(
    new ButtonBuilder()
      .setCustomId(`${PREFIX_LEAVE}${mid}`)
      .setLabel("Выйти")
      .setStyle(ButtonStyle.Danger),
  );
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(row1comps);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX_TOGGLE}${mid}`)
      .setLabel(state.open ? "Закрыть список" : "Открыть список")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${PREFIX_GRANT_MAIN}${mid}`)
      .setLabel("Выдать баллы основе")
      .setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

async function persistAndRefresh(interaction: ButtonInteraction, state: RosterRecord): Promise<void> {
  await upsertRosterRecord(state);
  const embed = buildRosterEmbed(state);
  const rows = buildRosterRows(state);
  await interaction.message.edit({ embeds: [embed], components: rows });
}

export type RosterPanelParams = {
  kind: RosterKind;
  postavkaNomer?: number;
  mainMax: number;
  subMax: number | null;
};

function rosterDraft(guildId: string, channelId: string, params: RosterPanelParams): Omit<RosterRecord, "messageId"> {
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

async function bindRosterToDiscordMessage(msg: Message<boolean>, draft: Omit<RosterRecord, "messageId">): Promise<void> {
  const ready: RosterRecord = { ...draft, messageId: msg.id };
  await upsertRosterRecord(ready);
  await msg.edit({
    content: "РП / GTA 5 RP",
    embeds: [buildRosterEmbed(ready)],
    components: buildRosterRows(ready),
  });
}

/** Создать панель из обычного сообщения в канале (например, текстом `/postavka 25`). */
export async function postRosterPanelToChannel(channel: GuildTextBasedChannel, params: RosterPanelParams): Promise<void> {
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

export async function createRosterPanel(interaction: ChatInputCommandInteraction, params: RosterPanelParams): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Только на сервере.", flags: MessageFlags.Ephemeral });
    return;
  }
  const channel = interaction.channel;
  if (!channel?.isTextBased()) {
    await interaction.reply({ content: "Команда работает только в текстовом канале.", flags: MessageFlags.Ephemeral });
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

function subHasRoom(state: RosterRecord): boolean {
  if (state.subMax == null) return true;
  return state.subUserIds.length < state.subMax;
}

function removeUserEverywhere(state: RosterRecord, userId: string): void {
  state.mainUserIds = state.mainUserIds.filter((id) => id !== userId);
  state.subUserIds = state.subUserIds.filter((id) => id !== userId);
  state.rkUserIds = state.rkUserIds.filter((id) => id !== userId);
}

function rkHasRoom(state: RosterRecord): boolean {
  if (state.rkMax == null) return false;
  return state.rkUserIds.length < state.rkMax;
}

function canGrantVoicePoints(member: GuildMember): boolean {
  const ids = config.VOICE_POINTS_GRANT_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((id) => member.roles.cache.has(id));
}

function parsePositiveAmount(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

export async function handleRpRosterButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  let messageId: string | null = null;
  let mode: "main" | "sub" | "rk" | "leave" | "toggle" | null = null;

  if (id.startsWith(PREFIX_MAIN)) {
    mode = "main";
    messageId = parseMessageId(id, PREFIX_MAIN);
  } else if (id.startsWith(PREFIX_SUB)) {
    mode = "sub";
    messageId = parseMessageId(id, PREFIX_SUB);
  } else if (id.startsWith(PREFIX_RK)) {
    mode = "rk";
    messageId = parseMessageId(id, PREFIX_RK);
  } else if (id.startsWith(PREFIX_LEAVE)) {
    mode = "leave";
    messageId = parseMessageId(id, PREFIX_LEAVE);
  } else if (id.startsWith(PREFIX_TOGGLE)) {
    mode = "toggle";
    messageId = parseMessageId(id, PREFIX_TOGGLE);
  } else if (id.startsWith(PREFIX_GRANT_MAIN)) {
    mode = "toggle";
    messageId = parseMessageId(id, PREFIX_GRANT_MAIN);
  }

  if (!messageId || !mode) return false;

  if (id.startsWith(PREFIX_GRANT_MAIN)) {
    const guild = interaction.guild;
    if (!guild) return true;
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !canGrantVoicePoints(member)) {
      await interaction.reply({ content: "У вас нет роли для выдачи баллов.", flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    const record = await getRosterRecord(messageId);
    if (!record) {
      await interaction.reply({ content: "Этот список устарел или удалён.", flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    if (record.mainUserIds.length === 0) {
      await interaction.reply({ content: "В основном списке пока никого нет.", flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const modal = new ModalBuilder().setCustomId(`${GRANT_MAIN_MODAL_PREFIX}${messageId}`).setTitle("Выдать баллы основе");
    const amount = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("Сколько баллов выдать каждому")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(12)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amount));
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  await interaction.deferUpdate().catch(() => {});

  const result = await withRpRosterLock(messageId, async () => {
    const record = await getRosterRecord(messageId);
    if (!record) {
      return { error: "Этот список устарел или удалён." } as const;
    }

    const guild = interaction.guild;
    if (!guild || guild.id !== record.guildId) {
      return { error: "Неверный сервер." } as const;
    }

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);

    if (mode === "toggle") {
      if (!member || !(await isModerator(member))) {
        return { error: "Закрывать и открывать список могут только модераторы." } as const;
      }
      record.open = !record.open;
      await upsertRosterRecord(record);
      await interaction.message.edit({ embeds: [buildRosterEmbed(record)], components: buildRosterRows(record) });
      return { ok: true } as const;
    }

    if (!record.open) {
      return { error: "Список закрыт. Запись недоступна." } as const;
    }

    const uid = interaction.user.id;

    if (mode === "leave") {
      removeUserEverywhere(record, uid);
      await persistAndRefresh(interaction, record);
      return { ok: true } as const;
    }

    if (mode === "main") {
      const inMain = record.mainUserIds.includes(uid);
      const inSub = record.subUserIds.includes(uid);
      if (inMain) {
        return { error: "Вы уже в основном списке." } as const;
      }
      if (record.mainUserIds.length >= record.mainMax) {
        return { error: "Основной список заполнен." } as const;
      }
      removeUserEverywhere(record, uid);
      if (inSub) {
        /* place freed in sub */
      }
      record.mainUserIds.push(uid);
      await persistAndRefresh(interaction, record);
      return { ok: true } as const;
    }

    if (mode === "sub") {
      const inSub = record.subUserIds.includes(uid);
      if (inSub) {
        return { error: "Вы уже в списке замен." } as const;
      }
      if (!subHasRoom(record)) {
        return { error: "Список замен заполнен." } as const;
      }
      removeUserEverywhere(record, uid);
      record.subUserIds.push(uid);
      await persistAndRefresh(interaction, record);
      return { ok: true } as const;
    }

    if (mode === "rk") {
      if (record.kind !== "vzh" || record.rkMax == null) {
        return { error: "РК доступно только для списка ВЗХ." } as const;
      }
      if (record.rkUserIds.includes(uid)) {
        return { error: "Вы уже в списке РК." } as const;
      }
      if (!rkHasRoom(record)) {
        return { error: "Список РК заполнен (максимум 2 человека)." } as const;
      }
      removeUserEverywhere(record, uid);
      record.rkUserIds.push(uid);
      await persistAndRefresh(interaction, record);
      return { ok: true } as const;
    }

    return { error: "Неизвестное действие." } as const;
  });

  if ("error" in result && result.error) {
    await interaction.followUp({ content: result.error, flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  return true;
}

export async function handleRpRosterModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(GRANT_MAIN_MODAL_PREFIX)) return false;
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Команда доступна только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const messageId = parseMessageId(interaction.customId, GRANT_MAIN_MODAL_PREFIX);
  if (!messageId) {
    await interaction.reply({ content: "Неверные данные формы.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !canGrantVoicePoints(member)) {
    await interaction.reply({ content: "У вас нет роли для выдачи баллов.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const amount = parsePositiveAmount(interaction.fields.getTextInputValue("amount"));
  if (!amount) {
    await interaction.reply({ content: "Укажи корректное число баллов (> 0).", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const grantedUserIds = await withRpRosterLock(messageId, async () => {
    const record = await getRosterRecord(messageId);
    if (!record || record.guildId !== interaction.guild!.id) return [] as string[];
    const ids = [...new Set(record.mainUserIds)];
    for (const uid of ids) {
      await addBalance(interaction.guild!.id, uid, amount).catch(() => {});
    }
    return ids;
  });

  if (grantedUserIds.length === 0) {
    await interaction.editReply("Не удалось выдать баллы: основной список пуст или не найден.").catch(() => {});
    return true;
  }

  await interaction
    .editReply(`Готово. Выдано по **${amount}** баллов всем в основе (**${grantedUserIds.length}** чел.).`)
    .catch(() => {});

  if (config.VOICE_POINTS_LOG_CHANNEL_ID) {
    const log = await interaction.client.channels.fetch(config.VOICE_POINTS_LOG_CHANNEL_ID).catch(() => null);
    if (log && log.isTextBased()) {
      const textLog = log as any;
      await textLog
        .send({
          content:
            `Выдача баллов (основа РП): <@${interaction.user.id}> выдал(а) по **${amount}** баллов участникам основного списка: ` +
            grantedUserIds.map((id) => `<@${id}>`).join(", "),
          allowedMentions: { users: [interaction.user.id, ...grantedUserIds] },
        })
        .catch((e: any) => console.warn("[rp-roster] Failed to send main-list grant log:", e));
    }
  }

  return true;
}
