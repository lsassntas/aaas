import {
  PermissionFlagsBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { config } from "../config";
import { rassylkaSlashCommand } from "./broadcastDm";
import { createContractPanel } from "./contractPanel";
import { createRosterPanel } from "./rpRosterPanel";
import { handleVpzNewsSlashCommand, vpzNewsSlashCommand } from "./vpzNews";
import { addBalance, resetAllBalances } from "../storage/voicePoints";

const postavka = new SlashCommandBuilder()
  .setName("postavka")
  .setDescription("Поставка: список основы и замен (размер основы 20–27, замены без лимита)")
  .addIntegerOption((opt) =>
    opt
      .setName("nomer")
      .setDescription("Сколько мест в основе (20–27)")
      .setMinValue(20)
      .setMaxValue(27)
      .setRequired(true),
  );

const vzh = new SlashCommandBuilder()
  .setName("vzh")
  .setDescription("ВЗХ: 30 в основу, 5 замен, 2 РК — отдельная кнопка «В РК»");

const contrakt = new SlashCommandBuilder()
  .setName("contrakt")
  .setDescription("Панель записи в контракт: списание/возврат 150 баллов");

const voiceResetAll = new SlashCommandBuilder()
  .setName("voice_reset_all")
  .setDescription("Обнулить баллы voice points всем участникам сервера")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const voiceGrantMany = new SlashCommandBuilder()
  .setName("voice_grant_many")
  .setDescription("Выдать баллы нескольким участникам (по упоминаниям)")
  .addStringOption((opt) => opt.setName("users").setDescription("Список @упоминаний или ID через пробел/запятую").setRequired(true))
  .addIntegerOption((opt) => opt.setName("amount").setDescription("Сколько баллов выдать каждому").setMinValue(1).setRequired(true))
  .addStringOption((opt) => opt.setName("reason").setDescription("Причина (необязательно)").setMaxLength(120).setRequired(false));

export const rpSlashCommandBuilders = [postavka, vzh, contrakt, rassylkaSlashCommand, voiceResetAll, voiceGrantMany];
// Keep vpz_news in the same guild registration batch.
rpSlashCommandBuilders.push(vpzNewsSlashCommand);

function hasVoiceGrantRole(interaction: ChatInputCommandInteraction): boolean {
  const roleIds = config.VOICE_POINTS_GRANT_ROLE_IDS ?? [];
  if (roleIds.length === 0) return false;
  const member = interaction.member;
  if (!member || !("roles" in member)) return false;
  const memberRoleIds = (member.roles as any)?.cache;
  if (!memberRoleIds) return false;
  return roleIds.some((id) => memberRoleIds.has(id));
}

function parseMentionOrIdList(raw: string): string[] {
  const out = new Set<string>();
  const tokens = raw
    .split(/[\s,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const t of tokens) {
    const mention = t.match(/^<@!?(\d+)>$/);
    if (mention?.[1]) {
      out.add(mention[1]);
      continue;
    }
    if (/^\d+$/.test(t)) out.add(t);
  }
  return [...out];
}

export async function registerRpGuildCommands(client: Client): Promise<void> {
  const me = client.user;
  if (!me) {
    console.warn("[rp-commands] client.user missing, skip registering slash commands");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const body = rpSlashCommandBuilders.map((c) => c.toJSON());
  await rest.put(Routes.applicationGuildCommands(me.id, config.GUILD_ID), { body });
  console.log("[rp-commands] Registered /postavka, /vzh, /contrakt, /rassylka, /voice_reset_all, /voice_grant_many for guild", config.GUILD_ID);
}

export async function handleRpSlashCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.commandName === "vpz_news") return await handleVpzNewsSlashCommand(interaction);
  if (
    interaction.commandName !== "postavka" &&
    interaction.commandName !== "vzh" &&
    interaction.commandName !== "contrakt" &&
    interaction.commandName !== "voice_reset_all" &&
    interaction.commandName !== "voice_grant_many"
  ) {
    return false;
  }

  try {
    if (interaction.commandName === "voice_grant_many") {
      if (!interaction.guildId) return true;
      if (!hasVoiceGrantRole(interaction)) {
        await interaction.reply({
          content: "У вас нет роли для выдачи баллов.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      const usersRaw = interaction.options.getString("users", true);
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason")?.trim();
      const userIds = parseMentionOrIdList(usersRaw);

      if (userIds.length === 0) {
        await interaction.reply({
          content: "Не удалось распознать пользователей. Укажи @упоминания или ID.",
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let granted = 0;
      const grantedUserIds: string[] = [];
      for (const uid of userIds) {
        const member = await interaction.guild?.members.fetch(uid).catch(() => null);
        if (!member) continue;
        await addBalance(interaction.guildId, uid, amount);
        granted += 1;
        grantedUserIds.push(uid);
      }

      await interaction.editReply(
        `Готово. Выдано по **${amount}** баллов ${granted} пользователям.` +
          (reason ? `\nПричина: ${reason}` : ""),
      );

      if (granted > 0 && config.VOICE_POINTS_LOG_CHANNEL_ID) {
        const log = await interaction.client.channels.fetch(config.VOICE_POINTS_LOG_CHANNEL_ID).catch(() => null);
        if (log && log.isTextBased()) {
          const textLog = log as any;
          const mentions = grantedUserIds.map((id) => `<@${id}>`).join(", ");
          await textLog
            .send({
              content:
                `Выдача баллов (mass): <@${interaction.user.id}> выдал(а) по **${amount}** баллов пользователям: ${mentions}.` +
                (reason ? ` Причина: ${reason}` : ""),
              allowedMentions: { users: [interaction.user.id, ...grantedUserIds] },
            })
            .catch((e: any) => console.warn("[voicePoints:log] Failed to send mass grant log:", e));
        }
      }
      return true;
    }

    if (interaction.commandName === "voice_reset_all") {
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
      if (!isAdmin) {
        await interaction.reply({ content: "Команда доступна только администратору.", flags: MessageFlags.Ephemeral });
        return true;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const removed = await resetAllBalances(interaction.guildId!);
      await interaction.editReply(`Готово. Обнулены баллы у **${removed}** пользователей.`);
      return true;
    }

    if (interaction.commandName === "contrakt") {
      await createContractPanel(interaction);
      return true;
    }

    if (interaction.commandName === "postavka") {
      const nomer = interaction.options.getInteger("nomer", true);
      await createRosterPanel(interaction, {
        kind: "postavka",
        postavkaNomer: nomer,
        mainMax: nomer,
        subMax: null,
      });
      return true;
    }

    await createRosterPanel(interaction, {
      kind: "vzh",
      mainMax: 30,
      subMax: 5,
    });
    return true;
  } catch (e) {
    console.error("[rp-slash]", e);
    const hint =
      "Не удалось создать список. Проверь права бота в канале (сообщения, вложения, компоненты) и что бот запущен. В консоли — подробности.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: hint, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: hint, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return true;
  }
}
