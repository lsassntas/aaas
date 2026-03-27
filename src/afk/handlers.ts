import { MessageFlags, type ButtonInteraction, type Client, type GuildTextBasedChannel, type ModalSubmitInteraction } from "discord.js";
import { config } from "../config";
import { listAfk, removeAfk, upsertAfk } from "./storage";
import { publishOrUpdateAfkPanel } from "./panel";
import { AFK_ENTER_BUTTON_ID, AFK_ENTER_MODAL_ID, AFK_EXIT_BUTTON_ID, afkEnterModal } from "./ui";

function parseHhMm(input: string): { minutes: number } | null {
  const t = input.trim();
  const m = t.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || mm < 0 || mm >= 60) return null;
  const minutes = hh * 60 + mm;
  if (minutes <= 0) return null;
  return { minutes };
}

async function logToAfkChannel(client: Client, guildId: string, content: string) {
  if (!config.AFK_LOG_CHANNEL_ID) return;
  const ch = await client.channels.fetch(config.AFK_LOG_CHANNEL_ID).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  const text = ch as GuildTextBasedChannel;
  if (text.guild.id !== guildId) return;
  await text.send({ content }).catch(() => {});
}

export async function handleAfkButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.guild) return false;
  const id = interaction.customId;
  if (!id.startsWith("afk:")) return false;

  if (id === AFK_ENTER_BUTTON_ID) {
    await interaction.showModal(afkEnterModal());
    return true;
  }

  if (id === AFK_EXIT_BUTTON_ID) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    await removeAfk(interaction.guild.id, interaction.user.id);
    await publishOrUpdateAfkPanel(interaction.client);
    await logToAfkChannel(interaction.client, interaction.guild.id, `АФК: <@${interaction.user.id}> вышел(ла) из АФК.`);
    await interaction.editReply({ content: "Вы вышли из АФК." }).catch(() => {});
    return true;
  }

  return false;
}

export async function handleAfkModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.guild) return false;
  if (interaction.customId !== AFK_ENTER_MODAL_ID) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  const reason = (interaction.fields.getTextInputValue("reason") ?? "").trim();
  const time = (interaction.fields.getTextInputValue("time") ?? "").trim();
  const parsed = parseHhMm(time);
  if (!reason || !parsed) {
    await interaction.editReply({ content: "Неверные данные. Укажи причину и время в формате ЧЧ:ММ (например 1:30)." }).catch(() => {});
    return true;
  }

  const minutes = Math.min(parsed.minutes, config.AFK_MAX_MINUTES);
  await upsertAfk({ guildId: interaction.guild.id, userId: interaction.user.id, reason, minutes });
  await publishOrUpdateAfkPanel(interaction.client);

  const untilTs = Math.floor((Date.now() + minutes * 60_000) / 1000);
  await logToAfkChannel(
    interaction.client,
    interaction.guild.id,
    `АФК: <@${interaction.user.id}> встал(а) в АФК до <t:${untilTs}:t>. Причина: ${reason}`,
  );

  await interaction.editReply({ content: `Вы в АФК до <t:${untilTs}:t>.` }).catch(() => {});
  return true;
}

export async function cleanupAfkLoop(client: Client) {
  if (!config.AFK_PANEL_CHANNEL_ID) return;
  let lastSignature = "";
  setInterval(async () => {
    const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
    if (!guild) return;
    const entries = await listAfk(guild.id).catch(() => []);
    const signature = JSON.stringify(entries.map((e) => [e.userId, e.untilIso, e.reason]));
    if (signature !== lastSignature) {
      lastSignature = signature;
      await publishOrUpdateAfkPanel(client);
    }
  }, 60_000).unref?.();
}

