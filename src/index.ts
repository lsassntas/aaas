import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import { ensureBaseDirectories } from "./storage/mapping";
import { handleInteraction, registerPanelButtonIfMissing } from "./discord/handlers";
import { registerRpGuildCommands } from "./discord/rpCommands";
import { installRpTextCommands } from "./discord/rpTextCommands";
import { registerVoicePointsPanelIfMissing } from "./voicePoints/panel";
import { installVoicePointsTracker } from "./voicePoints/tracker";
import { publishOrUpdateAfkPanel } from "./afk/panel";
import { cleanupAfkLoop } from "./afk/handlers";
import { installWeeklyTicketsReportLoop } from "./weeklyTickets/report";
import { installTwitchAnnouncementsLoop } from "./twitch/announce";

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, async () => {
    console.log(`[ready] Logged in as ${client.user?.tag}`);
    await ensureBaseDirectories().catch((e) => console.error(e));
    await registerPanelButtonIfMissing(client).catch((e) => console.error(e));
    await registerVoicePointsPanelIfMissing(client).catch((e) => console.error(e));
    await publishOrUpdateAfkPanel(client).catch((e) => console.error(e));
    await cleanupAfkLoop(client).catch((e) => console.error(e));
    await registerRpGuildCommands(client).catch((e) => console.error(e));
    if (client.options.intents.has(GatewayIntentBits.MessageContent)) {
      console.log(
        "[rp-text] Обычные сообщения /postavka N и /vzh (включи Message Content Intent в портале разработчика, если текста нет).",
      );
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction).catch((e) => console.error(e));
  });
  client.on(Events.Error, (e) => {
    console.error("[discord-client:error]", e);
  });

  installRpTextCommands(client);
  installVoicePointsTracker(client);
  installWeeklyTicketsReportLoop(client);
  installTwitchAnnouncementsLoop(client);

  await client.login(config.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

