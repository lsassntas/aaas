"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpSlashCommandBuilders = void 0;
exports.registerRpGuildCommands = registerRpGuildCommands;
exports.handleRpSlashCommand = handleRpSlashCommand;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const broadcastDm_1 = require("./broadcastDm");
const rpRosterPanel_1 = require("./rpRosterPanel");
const postavka = new discord_js_1.SlashCommandBuilder()
    .setName("postavka")
    .setDescription("Поставка: список основы и замен (размер основы 20–27, замены без лимита)")
    .addIntegerOption((opt) => opt
    .setName("nomer")
    .setDescription("Сколько мест в основе (20–27)")
    .setMinValue(20)
    .setMaxValue(27)
    .setRequired(true));
const vzh = new discord_js_1.SlashCommandBuilder()
    .setName("vzh")
    .setDescription("ВЗХ: 30 в основу, 5 замен, 2 РК — отдельная кнопка «В РК»");
exports.rpSlashCommandBuilders = [postavka, vzh, broadcastDm_1.rassylkaSlashCommand];
async function registerRpGuildCommands(client) {
    const me = client.user;
    if (!me) {
        console.warn("[rp-commands] client.user missing, skip registering slash commands");
        return;
    }
    const rest = new discord_js_1.REST({ version: "10" }).setToken(config_1.config.DISCORD_TOKEN);
    const body = exports.rpSlashCommandBuilders.map((c) => c.toJSON());
    await rest.put(discord_js_1.Routes.applicationGuildCommands(me.id, config_1.config.GUILD_ID), { body });
    console.log("[rp-commands] Registered /postavka, /vzh, /rassylka for guild", config_1.config.GUILD_ID);
}
async function handleRpSlashCommand(interaction) {
    if (interaction.commandName !== "postavka" && interaction.commandName !== "vzh")
        return false;
    try {
        if (interaction.commandName === "postavka") {
            const nomer = interaction.options.getInteger("nomer", true);
            await (0, rpRosterPanel_1.createRosterPanel)(interaction, {
                kind: "postavka",
                postavkaNomer: nomer,
                mainMax: nomer,
                subMax: null,
            });
            return true;
        }
        await (0, rpRosterPanel_1.createRosterPanel)(interaction, {
            kind: "vzh",
            mainMax: 30,
            subMax: 5,
        });
        return true;
    }
    catch (e) {
        console.error("[rp-slash]", e);
        const hint = "Не удалось создать список. Проверь права бота в канале (сообщения, вложения, компоненты) и что бот запущен. В консоли — подробности.";
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: hint, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        }
        else {
            await interaction.reply({ content: hint, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => { });
        }
        return true;
    }
}
