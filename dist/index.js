"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const mapping_1 = require("./storage/mapping");
const handlers_1 = require("./discord/handlers");
const rpCommands_1 = require("./discord/rpCommands");
const rpTextCommands_1 = require("./discord/rpTextCommands");
const panel_1 = require("./voicePoints/panel");
const tracker_1 = require("./voicePoints/tracker");
const panel_2 = require("./afk/panel");
const handlers_2 = require("./afk/handlers");
const report_1 = require("./weeklyTickets/report");
const announce_1 = require("./twitch/announce");
async function main() {
    const client = new discord_js_1.Client({
        intents: [
            discord_js_1.GatewayIntentBits.Guilds,
            discord_js_1.GatewayIntentBits.GuildMembers,
            discord_js_1.GatewayIntentBits.GuildVoiceStates,
            discord_js_1.GatewayIntentBits.GuildMessages,
            discord_js_1.GatewayIntentBits.MessageContent,
        ],
    });
    client.once(discord_js_1.Events.ClientReady, async () => {
        console.log(`[ready] Logged in as ${client.user?.tag}`);
        await (0, mapping_1.ensureBaseDirectories)().catch((e) => console.error(e));
        await (0, handlers_1.registerPanelButtonIfMissing)(client).catch((e) => console.error(e));
        await (0, panel_1.registerVoicePointsPanelIfMissing)(client).catch((e) => console.error(e));
        await (0, panel_2.publishOrUpdateAfkPanel)(client).catch((e) => console.error(e));
        await (0, handlers_2.cleanupAfkLoop)(client).catch((e) => console.error(e));
        await (0, rpCommands_1.registerRpGuildCommands)(client).catch((e) => console.error(e));
        if (client.options.intents.has(discord_js_1.GatewayIntentBits.MessageContent)) {
            console.log("[rp-text] Обычные сообщения /postavka N и /vzh (включи Message Content Intent в портале разработчика, если текста нет).");
        }
    });
    client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
        await (0, handlers_1.handleInteraction)(interaction).catch((e) => console.error(e));
    });
    client.on(discord_js_1.Events.Error, (e) => {
        console.error("[discord-client:error]", e);
    });
    (0, rpTextCommands_1.installRpTextCommands)(client);
    (0, tracker_1.installVoicePointsTracker)(client);
    (0, report_1.installWeeklyTicketsReportLoop)(client);
    (0, announce_1.installTwitchAnnouncementsLoop)(client);
    await client.login(config_1.config.DISCORD_TOKEN);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
