import { MessageFlags, type ButtonInteraction, type GuildTextBasedChannel } from "discord.js";
import { config } from "../config";
import { getBalance, subtractBalanceIfEnough } from "../storage/voicePoints";
import { VOICE_PANEL_BALANCE_ID, VOICE_PANEL_BUY_REMOVE_JAMB_ID } from "./ui";
import { VOICE_PANEL_GRANT_ID, handleGrantButton } from "./grant";

const GOODS = {
  remove_jamb: { label: "Снятие косяка", cost: 1000 },
} as const;

export async function handleVoicePointsButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.guild) return false;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const id = interaction.customId;

  if (!id.startsWith("voice:")) return false;

  if (id === VOICE_PANEL_GRANT_ID) {
    return await handleGrantButton(interaction);
  }

  const safeEphemeralReply = async (content: string) => {
    // 3-second safety: ack first, then edit; fall back to reply/followUp.
    const deferred = await interaction.deferReply({ flags: MessageFlags.Ephemeral }).then(
      () => true,
      () => false,
    );
    if (deferred) {
      await interaction.editReply({ content }).catch(() => {});
      return;
    }
    if (!interaction.replied) {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  };

  if (id === VOICE_PANEL_BALANCE_ID) {
    const bal = await getBalance(guildId, userId);
    await safeEphemeralReply(`Ваш баланс: **${bal}** баллов.`);
    return true;
  }

  const buy = id === VOICE_PANEL_BUY_REMOVE_JAMB_ID ? { key: "remove_jamb" as const, ...GOODS.remove_jamb } : null;

  if (!buy) return false;

  const res = await subtractBalanceIfEnough(guildId, userId, buy.cost);
  if (!res.ok) {
    await safeEphemeralReply(`Недостаточно баллов. Нужно **${buy.cost}**, у вас **${res.balance}**.`);
    return true;
  }

  await safeEphemeralReply(`Покупка: **${buy.label}** за **${buy.cost}** баллов.\nОстаток: **${res.balance}**.`);

  if (config.VOICE_POINTS_LOG_CHANNEL_ID) {
    const log = await interaction.client.channels.fetch(config.VOICE_POINTS_LOG_CHANNEL_ID).catch(() => null);
    if (!log) {
      console.warn(`[voicePoints:log] Log channel not found: ${config.VOICE_POINTS_LOG_CHANNEL_ID}`);
    } else if (!log.isTextBased()) {
      console.warn(`[voicePoints:log] Log channel is not text-based: ${config.VOICE_POINTS_LOG_CHANNEL_ID}`);
    } else {
      const textLog = log as GuildTextBasedChannel;
      const me = textLog.guild?.members?.me ?? (await textLog.guild.members.fetchMe().catch(() => null));
      const perms = me ? textLog.permissionsFor(me) : null;
      if (!perms?.has(["ViewChannel", "SendMessages"] as any)) {
        console.warn(`[voicePoints:log] Missing permissions in log channel ${textLog.id}: need ViewChannel + SendMessages`);
      } else {
        await textLog
          .send({
            content: `Покупка (voice points): <@${userId}> купил(а) **${buy.label}** за **${buy.cost}** баллов. Остаток: **${res.balance}**.`,
            allowedMentions: { users: [userId] },
          })
          .catch((e) => console.warn("[voicePoints:log] Failed to send purchase log:", e));
      }
    }
  } else {
    console.log("[voicePoints:log] VOICE_POINTS_LOG_CHANNEL_ID not set; skipping purchase log");
  }

  return true;
}

