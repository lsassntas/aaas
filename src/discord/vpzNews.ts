import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
} from "discord.js";
import { config } from "../config";

export const vpzNewsSlashCommand = new SlashCommandBuilder()
  .setName("vpz_news")
  .setDescription("Разослать сообщение в ЛС людям с выбранной ролью")
  .addRoleOption((opt) => opt.setName("role").setDescription("Кому отправить (роль)").setRequired(true));

const MODAL_ID_PREFIX = "vpz:news:";
const TEXT_ID = "vpz:news:text";

async function isModerator(member: GuildMember): Promise<boolean> {
  const ids = config.MODERATOR_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((id) => member.roles.cache.has(id));
}

function mkModal(roleId: string) {
  const modal = new ModalBuilder().setCustomId(`${MODAL_ID_PREFIX}${roleId}`).setTitle("VPZ News");
  const text = new TextInputBuilder()
    .setCustomId(TEXT_ID)
    .setLabel("Текст рассылки")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2000)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(text));
  return modal;
}

export async function handleVpzNewsSlashCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.commandName !== "vpz_news") return false;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Команда работает только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const caller = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!caller || !(await isModerator(caller))) {
    await interaction.reply({
      content: "Нет прав. Нужна одна из ролей модератора (**MODERATOR_ROLE_ID** в настройках бота).",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const role = interaction.options.getRole("role", true);
  await interaction.showModal(mkModal(role.id)).catch(async () => {
    await interaction.reply({ content: "Не удалось открыть окно ввода.", flags: MessageFlags.Ephemeral }).catch(() => {});
  });
  return true;
}

export async function handleVpzNewsModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(MODAL_ID_PREFIX)) return false;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Команда работает только на сервере.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const caller = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!caller || !(await isModerator(caller))) {
    await interaction.reply({ content: "Нет прав.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  const roleId = interaction.customId.slice(MODAL_ID_PREFIX.length).trim();
  const text = interaction.fields.getTextInputValue(TEXT_ID)?.trim() ?? "";
  if (!roleId || !text) {
    await interaction.reply({ content: "Пустой текст/роль.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

  try {
    await guild.members.fetch();
  } catch (e) {
    await interaction.editReply({
      content: "Не удалось загрузить участников. В Developer Portal → Bot включи **Server Members Intent** и перезапусти бота.",
    });
    return true;
  }

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: "Роль не найдена." }).catch(() => {});
    return true;
  }

  let ok = 0;
  let fail = 0;
  let bots = 0;

  for (const m of role.members.values()) {
    if (m.user.bot) {
      bots++;
      continue;
    }
    try {
      await m.send({ content: text });
      ok++;
    } catch {
      fail++;
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  await interaction.editReply({
    content:
      `Рассылка завершена. Роль: <@&${roleId}>\n` +
      `**Доставлено:** ${ok}\n` +
      `**Не доставлено:** ${fail}\n` +
      `**Ботов пропустили:** ${bots}`,
  });
  return true;
}

