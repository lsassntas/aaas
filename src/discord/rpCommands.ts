import {
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

export const rpSlashCommandBuilders = [postavka, vzh, contrakt, rassylkaSlashCommand];
// Keep vpz_news in the same guild registration batch.
rpSlashCommandBuilders.push(vpzNewsSlashCommand);

export async function registerRpGuildCommands(client: Client): Promise<void> {
  const me = client.user;
  if (!me) {
    console.warn("[rp-commands] client.user missing, skip registering slash commands");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const body = rpSlashCommandBuilders.map((c) => c.toJSON());
  await rest.put(Routes.applicationGuildCommands(me.id, config.GUILD_ID), { body });
  console.log("[rp-commands] Registered /postavka, /vzh, /contrakt, /rassylka for guild", config.GUILD_ID);
}

export async function handleRpSlashCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.commandName === "vpz_news") return await handleVpzNewsSlashCommand(interaction);
  if (interaction.commandName !== "postavka" && interaction.commandName !== "vzh" && interaction.commandName !== "contrakt") return false;

  try {
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
