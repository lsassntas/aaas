import {
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
  PermissionsBitField,
  type ButtonInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
} from "discord.js";
import { config } from "../config";
import { applicationModal, panelApplyButton, PANEL_APPLY_CUSTOM_ID, APPLICATION_MODAL_CUSTOM_ID, reviewButtons, reviewEmbed } from "./ui";
import { buildRecord, createApplicationFolder, deleteApplicationFolder, generateApplicationId } from "../storage/applications";
import { deleteApplication, ensureBaseDirectories, getApplication, upsertApplication, updateApplicationStatus } from "../storage/mapping";
import type { ApplicationForm, ApplicationRecord } from "../types";
import { handleVoicePointsButton } from "../voicePoints/handlers";
import { handleGrantModal } from "../voicePoints/grant";
import { handleAfkButton, handleAfkModal } from "../afk/handlers";

const folderLock = new Map<string, Promise<void>>();

async function withFolderLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = folderLock.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => (release = res));
  folderLock.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    // best-effort cleanup
    if (folderLock.get(key)) folderLock.delete(key);
  }
}

async function isModerator(member: GuildMember): Promise<boolean> {
  const ids = config.MODERATOR_ROLE_IDS ?? [];
  if (ids.length === 0) return false;
  return ids.some((id) => member.roles.cache.has(id));
}

function getTextInputValue(modal: ModalSubmitInteraction, id: string): string {
  const v = modal.fields.getTextInputValue(id);
  return v?.trim() ?? "";
}

function sanitizeForChannelName(nickLevelAge: string, applicationId: string): string {
  // Discord channel names allow letters/digits/hyphen. We'll be conservative.
  const nick = nickLevelAge
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = nick.slice(0, 20) || "zayavka";
  const suffix = applicationId.slice(0, 8);
  return `zayavka-${prefix}-${suffix}`;
}

export async function registerPanelButtonIfMissing(client: any) {
  // Отправляем панель-кнопку в PANEL_CHANNEL_ID, если бота ещё не настроили вручную.
  const panelMessageText =
    "**Заявки в семью.**\n" +
    "**Путь в семью начинается здесь!**\n\n" +
    "**Уведомление о приглашении на обзвон обычно отправляется в личные сообщения.**\n\n" +
    "**Обычно заявки обрабатываются в течение 1–7 дней — всё зависит от того, насколько загружены наши рекрутеры на данный момент.**\n\n" +
    "**Подать заявку можно только при открытом наборе. Если не выходит — набор закрыт. Внимательно прочтите сообщение ниже.**";

  const channel = await client.channels.fetch(config.PANEL_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) return;
  const textChannel = channel as GuildTextBasedChannel;

  const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
  const perms = me ? textChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
    console.warn(
      `[panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages. Set PANEL_CHANNEL_ID to a channel where the bot can write.`,
    );
    return;
  }

  const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
  if (recent) {
    for (const m of recent.values()) {
      // Use loose typing here; component types differ between API versions.
      const rows: any[] = (m as any).components ?? [];
      for (const row of rows) {
        const comps: any[] = row?.components ?? [];
        for (const comp of comps) {
          if (comp?.customId === PANEL_APPLY_CUSTOM_ID) {
            // Если кнопка уже есть, обновим только текст сообщения.
            await m.edit({ content: panelMessageText }).catch(() => {});
            return;
          }
        }
      }
    }
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(panelApplyButton());
  await textChannel.send({ components: [row], content: panelMessageText }).catch((e: any) => {
    if (e?.code === 50013) {
      console.warn(
        `[panel] DiscordAPIError 50013 Missing Permissions while sending to ${textChannel.id}. Check bot permissions.`,
      );
      return;
    }
    throw e;
  });
}

export async function handleInteraction(interaction: any) {
  try {
    if (interaction.isButton()) {
      return await handleButton(interaction as ButtonInteraction);
    }
    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;
      if (modal.customId.startsWith("voice:")) {
        const handled = await handleGrantModal(modal);
        if (handled) return;
      }
      if (modal.customId.startsWith("afk:")) {
        const handled = await handleAfkModal(modal);
        if (handled) return;
      }
      return await handleModalSubmit(modal);
    }
  } catch (e) {
    console.error(e);
    if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Ошибка при обработке запроса.", ephemeral: true }).catch(() => {});
    }
  }
}

async function ensureRecordFolderLink(applicationId: string, folderName: string, discordChannelId: string, reviewMessageId: string, discordUserId: string, nickFromForm: string, form: ApplicationForm) {
  const record = buildRecord({
    applicationId,
    folderName,
    discordChannelId,
    reviewMessageId,
    discordUserId,
    nickFromForm,
    form,
    status: "submitted",
  });
  await upsertApplication(record);
  return record;
}

async function handleButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("voice:")) {
    const handled = await handleVoicePointsButton(interaction);
    if (handled) return;
  }

  if (customId.startsWith("afk:")) {
    const handled = await handleAfkButton(interaction);
    if (handled) return;
  }

  if (customId === PANEL_APPLY_CUSTOM_ID) {
    await interaction.showModal(applicationModal());
    return;
  }

  // Review actions: family:review:<action>:<applicationId>
  if (customId.startsWith("family:review:")) {
    const [, , action, applicationId] = customId.split(":");
    if (!applicationId) return;
    const guild = interaction.guild;
    if (!guild) return;

    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !(await isModerator(member))) {
      await interaction.reply({ content: "У вас нет прав для принятия заявок.", ephemeral: true });
      return;
    }

    const record = await getApplication(applicationId);
    if (!record) {
      await interaction.reply({ content: "Заявка не найдена.", ephemeral: true });
      return;
    }

    if (record.status === "accepted" || record.status === "rejected") {
      await interaction.reply({ content: "Эта заявка уже обработана.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const decisionStatus: ApplicationRecord["status"] =
      action === "accept"
        ? "accepted"
        : action === "reject"
          ? "rejected"
          : action === "review_call"
            ? "in_reviewing"
            : "in_review";

    const folderKey = record.folderName;

    // DM applicant when moderator "Вызвать на обзор"
    if (action === "review_call") {
      const applicantId = record.discordUserId;
      try {
        const applicant = await interaction.client.users.fetch(applicantId);
        await applicant.send("Вы вызваны на обзвон.");
      } catch (e) {
        // If user disabled DMs, don't block the moderation action.
        console.warn(`Failed to DM user ${applicantId}:`, e);
      }
    }

    await withFolderLock(folderKey, async () => {
      if (action === "accept" || action === "reject") {
        await deleteApplicationFolder(record.folderName);
        await deleteApplication(record.applicationId);
      } else {
        await updateApplicationStatus(record.applicationId, decisionStatus);
      }
    });

    // Disable buttons in the review message
    if (interaction.message && "edit" in interaction.message) {
      const finalDecision = action === "accept" || action === "reject";
      const buttons = reviewButtons(record.applicationId, finalDecision);
      await interaction.message.edit({ components: [buttons.row] }).catch(() => {});
    }

    // Log only on final decision
    if (action === "accept" || action === "reject") {
      // Delete the application Discord channel as well.
      try {
        const appChannel = await interaction.client.channels.fetch(record.discordChannelId).catch(() => null);
        if (appChannel?.isTextBased() && "delete" in appChannel) {
          await (appChannel as any).delete(`Заявка ${action === "accept" ? "принята" : "отклонена"}`);
        }
      } catch (e) {
        console.warn(`Failed to delete application channel ${record.discordChannelId}:`, e);
      }

      const logChannel = await interaction.client.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const statusText = action === "accept" ? "Принято" : "Отклонено";
        const embed = reviewEmbed({
          nickLevelAge: record.form.nickLevelAge,
          projectPlayTime: record.form.projectPlayTime,
          previousFamilies: record.form.previousFamilies,
          damageDm10: record.form.damageDm10,
          authorTag: `<@${record.discordUserId}>`,
          applicationId: record.applicationId,
          statusText,
        }).setTitle("Лог заявки (модерация)");

        await (logChannel as GuildTextBasedChannel).send({ embeds: [embed] });
      }
    }

    await interaction.editReply({ content: "Готово." }).catch(() => {});
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== APPLICATION_MODAL_CUSTOM_ID) return;

  await interaction.deferReply({ ephemeral: true });

  const nickLevelAge = getTextInputValue(interaction, "nick_level_age");
  const projectPlayTime = getTextInputValue(interaction, "project_play_time");
  const previousFamilies = getTextInputValue(interaction, "previous_families");
  const damageDm10 = getTextInputValue(interaction, "damage_dm10");

  const form: ApplicationForm = {
    nickLevelAge,
    projectPlayTime,
    previousFamilies,
    damageDm10,
  };

  await ensureBaseDirectories();

  const applicationId = generateApplicationId();

  const applicationFolder = await createApplicationFolder({
    applicationId,
    nickLevelAge,
    form,
  });

  const discordChannelName = sanitizeForChannelName(nickLevelAge, applicationId);

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "Заявка не может быть создана вне сервера." });
    return;
  }

  const category = await guild.channels.fetch(config.CATEGORY_ID).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    await interaction.editReply({ content: "Не найдена категория для заявок." });
    return;
  }

  const channel = await guild.channels
    .create({
      name: discordChannelName,
      type: ChannelType.GuildText,
      parent: config.CATEGORY_ID,
      topic: `Заявка: ${nickLevelAge}`,
    })
    .catch(async (e: any) => {
      console.error(e);
      await interaction.editReply({ content: "Не удалось создать канал заявки." });
      return null;
    });

  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ content: "Не удалось создать канал заявки." });
    return;
  }

  const disabled = false;
  const buttons = reviewButtons(applicationId, disabled);

  const embed = reviewEmbed({
    nickLevelAge,
    projectPlayTime,
    previousFamilies,
    damageDm10,
    authorTag: `<@${interaction.user.id}>`,
    applicationId,
    statusText: "В очереди на модерацию",
  });

  const reviewMessage = await channel.send({
    content: "Модераторы, обработайте заявку:",
    embeds: [embed],
    components: [buttons.row],
  });

  const record = await ensureRecordFolderLink(
    applicationId,
    applicationFolder.folderName,
    channel.id,
    reviewMessage.id,
    interaction.user.id,
    applicationFolder.nickFromForm,
    form,
  );

  await interaction.editReply({ content: `Заявка создана. Канал: ${channel}` });
}

