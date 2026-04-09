import type { Client, VoiceState } from "discord.js";
import { config } from "../config";
import { addBalance } from "../storage/voicePoints";
import { isUserAfk } from "../afk/storage";

type SessionKey = string; // `${guildId}:${userId}`
const VOICE_POINTS_PER_HOUR = 5;
const MS_IN_HOUR = 60 * 60 * 1000;

function sessionKey(guildId: string, userId: string): SessionKey {
  return `${guildId}:${userId}`;
}

async function isEligible(state: VoiceState): Promise<boolean> {
  const ch = state.channel;
  if (!ch) return false;
  if (config.VOICE_POINTS_AFK_CHANNEL_ID && ch.id === config.VOICE_POINTS_AFK_CHANNEL_ID) return false;

  // Disallow if user is muted/deafened by self or server.
  if (state.selfMute || state.serverMute) return false;
  if (state.selfDeaf || state.serverDeaf) return false;
  // Stage channels / suppressed state: treat as not eligible for earning.
  if (state.suppress) return false;

  // If member is a bot, ignore.
  if (state.member?.user?.bot) return false;

  // If user marked as AFK (panel), don't earn.
  if (state.guild?.id && state.id) {
    const afk = await isUserAfk(state.guild.id, state.id).catch(() => false);
    if (afk) return false;
  }

  return true;
}

export function installVoicePointsTracker(client: Client) {
  const sessions = new Map<SessionKey, number>(); // startMs

  async function stopAndCredit(state: VoiceState, stopMs: number) {
    const guildId = state.guild?.id;
    const userId = state.id;
    if (!guildId || !userId) return;

    const k = sessionKey(guildId, userId);
    const start = sessions.get(k);
    if (!start) return;

    sessions.delete(k);

    const elapsedMs = Math.max(0, stopMs - start);
    const fullHours = Math.floor(elapsedMs / MS_IN_HOUR);
    if (fullHours <= 0) return;

    await addBalance(guildId, userId, fullHours * VOICE_POINTS_PER_HOUR).catch((e) => {
      console.error("[voicePoints:tracker] Failed to add balance:", e);
    });
  }

  function start(state: VoiceState, startMs: number) {
    const guildId = state.guild?.id;
    const userId = state.id;
    if (!guildId || !userId) return;
    sessions.set(sessionKey(guildId, userId), startMs);
  }

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const now = Date.now();
      const was = await isEligible(oldState);
      const nowEligible = await isEligible(newState);

      if (!was && nowEligible) {
        start(newState, now);
        return;
      }

      if (was && !nowEligible) {
        await stopAndCredit(oldState, now);
        return;
      }
      // If still eligible, do nothing (session continues across channel moves).
    } catch (e) {
      console.error("[voicePoints:tracker] voiceStateUpdate failed:", e);
    }
  });

  client.on("ready", async () => {
    try {
      if (!config.VOICE_POINTS_PANEL_CHANNEL_ID) return;
      const guild = await client.guilds.fetch(config.GUILD_ID).catch(() => null);
      if (!guild) return;
      const fullGuild = await guild.fetch().catch(() => null);
      if (!fullGuild) return;

      for (const vs of fullGuild.voiceStates.cache.values()) {
        if (await isEligible(vs)) start(vs, Date.now());
      }
    } catch (e) {
      console.error("[voicePoints:tracker] ready init failed:", e);
    }
  });
}

