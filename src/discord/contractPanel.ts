import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { addBalance, subtractBalanceIfEnough } from "../storage/voicePoints";
import {
  getContractRosterRecord,
  type ContractRosterRecord,
  upsertContractRosterRecord,
  withContractLock,
} from "../storage/contractRoster";

const CONTRACT_COST = 150;
const JOIN_PREFIX = "contract:j:";
const LEAVE_PREFIX = "contract:l:";

function listJoined(userIds: string[]): string {
  if (userIds.length === 0) return "— пока никто не записался —";
  return userIds.map((id, i) => `${i + 1}. <@${id}>`).join("\n");
}

function contractEmbed(state: ContractRosterRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("Контракт")
    .setDescription("Записатся в контракт и снять 150 балов")
    .addFields({
      name: `Список записавшихся (${state.joinedUserIds.length})`,
      value: listJoined(state.joinedUserIds),
      inline: false,
    });
}

function contractButtons(messageId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${JOIN_PREFIX}${messageId}`).setLabel("Записаться в контракт").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${LEAVE_PREFIX}${messageId}`).setLabel("Выйти из контракта").setStyle(ButtonStyle.Danger),
  );
}

async function refreshMessage(interaction: ButtonInteraction, state: ContractRosterRecord): Promise<void> {
  await upsertContractRosterRecord(state);
  await interaction.message.edit({
    embeds: [contractEmbed(state)],
    components: [contractButtons(state.messageId)],
    allowedMentions: { users: [] },
  });
}

export async function createContractPanel(interaction: ChatInputCommandInteraction): Promise<void> {
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
  const state: ContractRosterRecord = {
    messageId: msg.id,
    channelId: channel.id,
    guildId: guild.id,
    joinedUserIds: [],
    cost: CONTRACT_COST,
  };
  await upsertContractRosterRecord(state);
  await msg.edit({
    content: "Контракт",
    embeds: [contractEmbed(state)],
    components: [contractButtons(state.messageId)],
    allowedMentions: { users: [] },
  });
}

export async function handleContractButton(interaction: ButtonInteraction): Promise<boolean> {
  const id = interaction.customId;
  const isJoin = id.startsWith(JOIN_PREFIX);
  const isLeave = id.startsWith(LEAVE_PREFIX);
  if (!isJoin && !isLeave) return false;

  const messageId = id.slice((isJoin ? JOIN_PREFIX : LEAVE_PREFIX).length);
  if (!/^\d+$/.test(messageId)) return true;

  await interaction.deferUpdate().catch(() => {});

  const result = await withContractLock(messageId, async () => {
    const state = await getContractRosterRecord(messageId);
    if (!state) return { error: "Эта панель устарела или удалена." } as const;
    if (!interaction.guild || interaction.guild.id !== state.guildId) return { error: "Неверный сервер." } as const;

    const uid = interaction.user.id;

    if (isJoin) {
      if (state.joinedUserIds.includes(uid)) return { error: "Вы уже записаны в контракт." } as const;
      const debit = await subtractBalanceIfEnough(state.guildId, uid, state.cost);
      if (!debit.ok) return { error: `Недостаточно баллов. Нужно **${state.cost}**, у вас **${debit.balance}**.` } as const;
      state.joinedUserIds.push(uid);
      await refreshMessage(interaction, state);
      return { ok: `Вы записались в контракт. Списано **${state.cost}** баллов. Остаток: **${debit.balance}**.` } as const;
    }

    if (!state.joinedUserIds.includes(uid)) return { error: "Вы не записаны в контракт." } as const;
    state.joinedUserIds = state.joinedUserIds.filter((x) => x !== uid);
    const balance = await addBalance(state.guildId, uid, state.cost);
    await refreshMessage(interaction, state);
    return { ok: `Вы вышли из контракта. Возвращено **${state.cost}** баллов. Баланс: **${balance}**.` } as const;
  });

  if ("error" in result) {
    await interaction.followUp({ content: result.error, flags: MessageFlags.Ephemeral }).catch(() => {});
  } else {
    await interaction.followUp({ content: result.ok, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return true;
}
