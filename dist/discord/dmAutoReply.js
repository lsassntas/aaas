"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installDmAutoReply = installDmAutoReply;
const discord_js_1 = require("discord.js");
const DM_AUTO_REPLY_TEXT = "бля лучше реакцию поставь, а не хуйней занимайся";
/**
 * Авто-ответ в личке: отвечаем фиксированной фразой на любой текст.
 * Требуется включенный `Message Content Intent` в коде и в Developer Portal.
 */
function installDmAutoReply(client) {
    client.on(discord_js_1.Events.MessageCreate, async (message) => {
        try {
            if (message.author.bot)
                return;
            if (message.guild)
                return; // только DM
            const text = message.content?.trim();
            if (!text)
                return;
            await message.reply(DM_AUTO_REPLY_TEXT).catch(() => { });
        }
        catch {
            // best-effort: ничего не логируем, чтобы не спамить консоль.
        }
    });
}
