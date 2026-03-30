import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { config } from "../config";

/** Пауза между ЛС — снижает риск rate limit. */
const DM_GAP_MS = 400;

export const rassylkaSlashCommand = new SlashCommandBuilder()
  .setName("rassylka")
  .setDescription("ЛС участникам, у кого есть одна из настроенных ролей получателей")
  .addStringOption((o) =>
    o
      .setName("tekst")
      .setDescription("Текст в ЛС участникам с одной из настроенных ролей получателей")
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

  const targetRoleIds = config.BROADCAST_DM_TARGET_ROLE_IDS;
  const memberMatchesTarget = (m: GuildMember) => targetRoleIds.some((id) => m.roles.cache.has(id));

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
    if (!memberMatchesTarget(m)) {
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

  const rolesHint =
    targetRoleIds.length <= 3
      ? targetRoleIds.map((id) => `\`${id}\``).join(", ")
      : `${targetRoleIds.length} ролей (список в .env)`;

  await interaction.editReply({
    content:
      `Рассылка завершена. Получатели — **хотя бы одна** из ролей: ${rolesHint}\n` +
      `**Доставлено:** ${ok}\n` +
      `**Не доставлено:** ${fail} (закрыты ЛС от сервера, бот в чёрном списке и т.п.)\n` +
      `**Без нужных ролей — пропущено:** ${skippedNoRole}\n` +
      `**Ботов пропустили:** ${bots}`,
  });

  return true;
}
