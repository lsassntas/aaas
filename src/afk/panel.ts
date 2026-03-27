import { PermissionsBitField, type Client, type GuildTextBasedChannel } from "discord.js";
import { config } from "../config";
import { listAfk } from "./storage";
import { afkButtons, afkEmbed } from "./ui";

function formatLines(entries: Awaited<ReturnType<typeof listAfk>>) {
  return entries.map((e) => {
    const untilTs = Math.floor(Date.parse(e.untilIso) / 1000);
    const reason = e.reason?.trim() ? ` — ${e.reason.trim()}` : "";
    return `- <@${e.userId}> до <t:${untilTs}:t>${reason}`;
  });
}

export async function publishOrUpdateAfkPanel(client: Client) {
  if (!config.AFK_PANEL_CHANNEL_ID) {
    console.log("[afk:panel] AFK_PANEL_CHANNEL_ID not set; skipping panel publish");
    return;
  }

  const channel = await client.channels.fetch(config.AFK_PANEL_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.warn(`[afk:panel] Channel not found: ${config.AFK_PANEL_CHANNEL_ID}`);
    return;
  }
  if (!channel.isTextBased()) {
    console.warn(`[afk:panel] Channel is not text-based: ${config.AFK_PANEL_CHANNEL_ID}`);
    return;
  }

  const textChannel = channel as GuildTextBasedChannel;
  const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
  const perms = me ? textChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
    console.warn(`[afk:panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages`);
    return;
  }

  const entries = await listAfk(textChannel.guild.id).catch(() => []);
  const embed = afkEmbed(formatLines(entries));
  const components = [afkButtons()];

  const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
  if (recent) {
    for (const m of recent.values()) {
      const embeds: any[] = (m as any).embeds ?? [];
      const has = embeds.some((e) => String(e?.title ?? "") === "Список АФК");
      if (!has) continue;
      await m.edit({ embeds: [embed], components }).catch(() => {});
      return;
    }
  }

  await textChannel
    .send({ embeds: [embed], components })
    .then(() => console.log(`[afk:panel] Panel sent to #${(textChannel as any)?.name ?? textChannel.id}`))
    .catch((e) => console.warn("[afk:panel] Failed to send panel:", e));
}

