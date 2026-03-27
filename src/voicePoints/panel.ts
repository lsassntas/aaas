import { PermissionsBitField, type Client, type GuildTextBasedChannel } from "discord.js";
import { config } from "../config";
import { voicePointsButtons, voicePointsEmbed } from "./ui";

export async function registerVoicePointsPanelIfMissing(client: Client) {
  if (!config.VOICE_POINTS_PANEL_CHANNEL_ID) {
    console.log("[voicePoints:panel] VOICE_POINTS_PANEL_CHANNEL_ID not set; skipping panel publish");
    return;
  }

  const channel = await client.channels.fetch(config.VOICE_POINTS_PANEL_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.warn(`[voicePoints:panel] Channel not found: ${config.VOICE_POINTS_PANEL_CHANNEL_ID}`);
    return;
  }
  if (!channel.isTextBased()) {
    console.warn(`[voicePoints:panel] Channel is not text-based: ${config.VOICE_POINTS_PANEL_CHANNEL_ID}`);
    return;
  }
  const textChannel = channel as GuildTextBasedChannel;

  const me = textChannel.guild?.members?.me ?? (await textChannel.guild.members.fetchMe().catch(() => null));
  const perms = me ? textChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
    console.warn(
      `[voicePoints:panel] Missing permissions in channel ${textChannel.id}: need ViewChannel + SendMessages`,
    );
    return;
  }

  const recent = await textChannel.messages.fetch({ limit: 10 }).catch(() => null);
  if (recent) {
    for (const m of recent.values()) {
      const embeds: any[] = (m as any).embeds ?? [];
      const rows: any[] = (m as any).components ?? [];
      const hasOurEmbed = embeds.some((e) => {
        const t = String(e?.title ?? "");
        return t === "Баллы за войс — Sportik" || t === "Баллы за войс — FENIMORE";
      });
      if (!hasOurEmbed) continue;
      const hasOurButtons = rows.some((row) => (row?.components ?? []).some((c: any) => String(c?.customId ?? "").startsWith("voice:")));
      if (hasOurButtons) {
        await m.edit({ embeds: [voicePointsEmbed()], components: [voicePointsButtons()] }).catch(() => {});
        return;
      }
    }
  }

  await textChannel
    .send({ embeds: [voicePointsEmbed()], components: [voicePointsButtons()] })
    .then(() => console.log(`[voicePoints:panel] Panel sent to #${(textChannel as any)?.name ?? textChannel.id}`))
    .catch((e) => console.warn("[voicePoints:panel] Failed to send panel:", e));
}

