"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installRpTextCommands = installRpTextCommands;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const rpRosterPanel_1 = require("./rpRosterPanel");
/**
 * Обработка обычного текста `/postavka 20` и `/vzh` в канале.
 * Стандартные slash-команды Discord — отдельный путь (InteractionCreate).
 *
 * Нужен включённый Message Content Intent в Discord Developer Portal → Bot, иначе текст сообщений в серверах будет пустой.
 */
function installRpTextCommands(client) {
    client.on(discord_js_1.Events.MessageCreate, async (message) => {
        try {
            if (message.author.bot)
                return;
            if (!message.guild || message.guild.id !== config_1.config.GUILD_ID)
                return;
            if (!message.channel.isTextBased())
                return;
            const text = message.content?.trim() ?? "";
            if (!text)
                return;
            if (/^\/vzh\s*$/i.test(text)) {
                await (0, rpRosterPanel_1.postRosterPanelToChannel)(message.channel, {
                    kind: "vzh",
                    mainMax: 30,
                    subMax: 5,
                });
                return;
            }
            const pk = text.match(/^\/postavka(?:\s+(\d{1,2}))?\s*$/i);
            if (pk) {
                const raw = pk[1];
                const n = raw ? parseInt(raw, 10) : NaN;
                if (!Number.isFinite(n) || n < 20 || n > 27) {
                    await message.reply("Для поставки укажите число **20–27** в том же сообщении, например: `/postavka 25`\n" +
                        "Либо нажми **`/`** и выбери приложение-бота → команду **postavka** (так надёжнее).");
                    return;
                }
                await (0, rpRosterPanel_1.postRosterPanelToChannel)(message.channel, {
                    kind: "postavka",
                    postavkaNomer: n,
                    mainMax: n,
                    subMax: null,
                });
            }
        }
        catch (e) {
            console.error("[rp-text]", e);
        }
    });
}
