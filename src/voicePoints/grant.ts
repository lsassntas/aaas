import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type GuildMember, type ModalSubmitInteraction } from "discord.js";
import { config } from "../config";
import { addBalance, getBalance } from "../storage/voicePoints";

export const VOICE_PANEL_GRANT_ID = "voice:grant";
export const VOICE_GRANT_MODAL_ID = "voice:grantModal";

function canGrant(member: GuildMember): boolean {
  const ids = config.VOICE_POINTS_GRANT_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((id) => member.roles.cache.has(id));
}

function parseUserId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  // <@123> or <@!123>
  const m = t.match(/^<@!?(\d+)>$/);
  if (m?.[1]) return m[1];
  if (/^\d+$/.test(t)) return t;
  return null;
}

function parseAmount(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

export function grantModal() {
  const modal = new ModalBuilder().setCustomId(VOICE_GRANT_MODAL_ID).setTitle("Выдать баллы");

  const user = new TextInputBuilder()
    .setCustomId("user")
    .setLabel("Пользователь (mention или ID)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const amount = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("Сколько баллов")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(12)
    .setRequired(true);

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Причина (необязательно)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(120)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(user),
    new ActionRowBuilder<TextInputBuilder>().addComponents(amount),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
  );

  return modal;
}

export async function handleGrantButton(interaction: ButtonInteraction): Promise<boolean> {
  if (interaction.customId !== VOICE_PANEL_GRANT_ID) return false;
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Команда доступна только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !canGrant(member)) {
    await interaction.reply({ content: "У вас нет прав выдавать баллы.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  await interaction.showModal(grantModal());
  return true;
}

export async function handleGrantModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (interaction.customId !== VOICE_GRANT_MODAL_ID) return false;
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "Команда доступна только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !canGrant(member)) {
    await interaction.reply({ content: "У вас нет прав выдавать баллы.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const rawUser = interaction.fields.getTextInputValue("user");
  const rawAmount = interaction.fields.getTextInputValue("amount");
  const reason = (interaction.fields.getTextInputValue("reason") ?? "").trim();

  const targetUserId = parseUserId(rawUser);
  const amount = parseAmount(rawAmount);
  if (!targetUserId || !amount) {
    await interaction.editReply({ content: "Неверные данные. Укажи пользователя (mention/ID) и число баллов." }).catch(() => {});
    return true;
  }

  // Basic guild safety: require that the user exists in this guild.
  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) {
    await interaction.editReply({ content: "Пользователь не найден на сервере." }).catch(() => {});
    return true;
  }

  // Optional permission: if you want, require ManageGuild etc. For now roles control access.
  const before = await getBalance(interaction.guild.id, targetUserId);
  const after = await addBalance(interaction.guild.id, targetUserId, amount);

  await interaction
    .editReply({
      content:
        `Выдано **${amount}** баллов пользователю <@${targetUserId}>.\n` +
        `Было: **${before}**, стало: **${after}**.` +
        (reason ? `\nПричина: ${reason}` : ""),
    })
    .catch(() => {});

  if (config.VOICE_POINTS_LOG_CHANNEL_ID) {
    const log = await interaction.client.channels.fetch(config.VOICE_POINTS_LOG_CHANNEL_ID).catch(() => null);
    if (!log) {
      console.warn(`[voicePoints:log] Log channel not found: ${config.VOICE_POINTS_LOG_CHANNEL_ID}`);
    } else if (!log.isTextBased()) {
      console.warn(`[voicePoints:log] Log channel is not text-based: ${config.VOICE_POINTS_LOG_CHANNEL_ID}`);
    } else {
      const textLog = log as any;
      await textLog
        .send({
          content:
            `Выдача баллов: <@${interaction.user.id}> выдал(а) <@${targetUserId}> **${amount}** баллов.` +
            (reason ? ` Причина: ${reason}` : ""),
          allowedMentions: { users: [interaction.user.id, targetUserId] },
        })
        .catch((e: any) => console.warn("[voicePoints:log] Failed to send grant log:", e));
    }
  } else {
    console.log("[voicePoints:log] VOICE_POINTS_LOG_CHANNEL_ID not set; skipping grant log");
  }

  return true;
}

