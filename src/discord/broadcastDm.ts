import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { config } from "../config";

/** Пауза между ЛС — снижает риск rate limit. */
const DM_GAP_MS = 400;

export const rassylkaSlashCommand = new SlashCommandBuilder()
  .setName("rassylka")
  .setDescription("Разослать текст в ЛС только участникам с настроенной ролью получателей")
  .addStringOption((o) =>
    o
      .setName("tekst")
      .setDescription("Текст в личку тем, у кого есть целевая роль")
      .setRequired(true)
      .setMaxLength(2000),
  );

async function isModerator(member: GuildMember): Promise<boolean> {
  const ids = config.MODERATOR_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((id) => member.roles.cache.has(id));
}

export async function handleRassylkaSlashCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.commandName !== "rassylka") return false;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Команда работает только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const caller = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!caller || !(await isModerator(caller))) {
    await interaction.editReply({
      content: "Нет прав. Нужна одна из ролей модератора (**MODERATOR_ROLE_ID** в настройках бота).",
    });
    return true;
  }

  const tekst = interaction.options.getString("tekst", true).trim();
  if (!tekst) {
    await interaction.editReply({ content: "Текст не может быть пустым." });
    return true;
  }

  try {
    await guild.members.fetch();
  } catch (e) {
    console.error("[rassylka] guild.members.fetch", e);
    await interaction.editReply({
      content:
        "Не удалось загрузить участников. В Developer Portal → Bot включи **Server Members Intent** и перезапусти бота.",
    });
    return true;
  }

  const targetRoleId = config.BROADCAST_DM_TARGET_ROLE_ID;

  let ok = 0;
  let fail = 0;
  let bots = 0;
  let skippedNoRole = 0;

  const members = [...guild.members.cache.values()];

  for (const m of members) {
    if (m.user.bot) {
      bots++;
      continue;
    }
    if (!m.roles.cache.has(targetRoleId)) {
      skippedNoRole++;
      continue;
    }
    try {
      await m.send({ content: tekst });
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 3) console.warn("[rassylka] DM failed", m.user.tag, e);
    }
    await new Promise((r) => setTimeout(r, DM_GAP_MS));
  }

  await interaction.editReply({
    content:
      `Рассылка завершена (роль получателей: \`${targetRoleId}\`).\n` +
      `**Доставлено:** ${ok}\n` +
      `**Не доставлено:** ${fail} (закрыты ЛС от сервера, бот в чёрном списке и т.п.)\n` +
      `**Без этой роли — пропущено:** ${skippedNoRole}\n` +
      `**Ботов пропустили:** ${bots}`,
  });

  return true;
}
