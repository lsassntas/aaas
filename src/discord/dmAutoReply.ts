import { Events, type Client, type Message } from "discord.js";

const DM_AUTO_REPLY_TEXT = "бля лучше реакцию поставь, а не хуйней занимайся";

/**
 * Авто-ответ в личке: отвечаем фиксированной фразой на любой текст.
 * Требуется включенный `Message Content Intent` в коде и в Developer Portal.
 */
export function installDmAutoReply(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return; // только DM
      const text = message.content?.trim();
      if (!text) return;

      await message.reply(DM_AUTO_REPLY_TEXT).catch(() => {});
    } catch {
      // best-effort: ничего не логируем, чтобы не спамить консоль.
    }
  });
}

