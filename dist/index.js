"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const mapping_1 = require("./storage/mapping");
const handlers_1 = require("./discord/handlers");
async function main() {
    const client = new discord_js_1.Client({
        intents: [discord_js_1.GatewayIntentBits.Guilds],
    });
    client.once(discord_js_1.Events.ClientReady, () => {
        console.log(`[ready] Logged in as ${client.user?.tag}`);
    });
    client.on(discord_js_1.Events.ClientReady, async () => {
        await (0, mapping_1.ensureBaseDirectories)().catch((e) => console.error(e));
        await (0, handlers_1.registerPanelButtonIfMissing)(client).catch((e) => console.error(e));
    });
    client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
        await (0, handlers_1.handleInteraction)(interaction).catch((e) => console.error(e));
    });
    await client.login(config_1.config.DISCORD_TOKEN);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
