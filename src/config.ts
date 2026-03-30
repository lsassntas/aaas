import "dotenv/config";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

function getEnvOptional(name: string): string | undefined {
  const v = process.env[name];
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

function parseDiscordId(name: string): string {
  const raw = mustGetEnv(name);
  // Discord snowflakes are digits; keep as string for precision.
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`Env var ${name} must be digits, got: ${raw}`);
  }
  return raw.trim();
}

function parseDiscordIdOptional(name: string): string | undefined {
  const raw = getEnvOptional(name);
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`Env var ${name} must be digits, got: ${raw}`);
  }
  return raw.trim();
}

function parseDiscordIdList(name: string): string[] {
  const raw = mustGetEnv(name);
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Env var ${name} must contain at least one id`);
  }
  for (const p of parts) {
    if (!/^\d+$/.test(p)) {
      throw new Error(`Env var ${name} must be comma-separated digits, got: ${raw}`);
    }
  }
  return parts;
}

function parseDiscordIdListOptional(name: string): string[] | undefined {
  const raw = getEnvOptional(name);
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) {
      throw new Error(`Env var ${name} must be comma-separated digits, got: ${raw}`);
    }
  }
  return parts;
}

function parseIntOptional(name: string): number | undefined {
  const raw = getEnvOptional(name);
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Env var ${name} must be an integer, got: ${raw}`);
  }
  return n;
}

/** Роли получателей `/rassylka`: несколько id через запятую в `BROADCAST_DM_TARGET_ROLE_IDS`, либо одна в `BROADCAST_DM_TARGET_ROLE_ID`. */
function resolveBroadcastDmTargetRoleIds(): string[] {
  const multi = parseDiscordIdListOptional("BROADCAST_DM_TARGET_ROLE_IDS");
  if (multi && multi.length > 0) return multi;
  const one = parseDiscordIdOptional("BROADCAST_DM_TARGET_ROLE_ID");
  if (one) return [one];
  return ["1017447381127663717"];
}

/** Роли рекрутеров: кому писать ЛС о новой заявке. */
function resolveRecruiterRoleIds(): string[] {
  // Preferred key for multiple role ids.
  const multi = parseDiscordIdListOptional("RECRUITER_ROLE_IDS");
  if (multi && multi.length > 0) return multi;

  // Backward-compatible: allow comma-separated ids in singular key too.
  const legacyMulti = parseDiscordIdListOptional("RECRUITER_ROLE_ID");
  if (legacyMulti && legacyMulti.length > 0) return legacyMulti;

  const one = parseDiscordIdOptional("RECRUITER_ROLE_ID");
  if (one) return [one];
  return [];
}

export type Config = {
  DISCORD_TOKEN: string;
  GUILD_ID: string;
  CATEGORY_ID: string;
  LOG_CHANNEL_ID: string;
  PANEL_CHANNEL_ID: string;
  MODERATOR_ROLE_IDS: string[];
  APPLICATIONS_BASE_PATH: string;

  // Weekly tickets report (optional; enabled when WEEKLY_TICKETS_REPORT_CHANNEL_ID is set)
  WEEKLY_TICKETS_REPORT_CHANNEL_ID?: string;
  // 0=Sunday ... 6=Saturday (default: 0)
  WEEKLY_TICKETS_REPORT_DOW: number;
  // 0..23 (default: 23)
  WEEKLY_TICKETS_REPORT_HOUR: number;
  // 0..59 (default: 55)
  WEEKLY_TICKETS_REPORT_MINUTE: number;
  // Minutes offset from UTC to interpret schedule + week boundaries (default: 0)
  WEEKLY_TICKETS_TZ_OFFSET_MINUTES: number;

  // Voice points (optional feature; enabled when VOICE_POINTS_PANEL_CHANNEL_ID is set)
  VOICE_POINTS_PANEL_CHANNEL_ID?: string;
  VOICE_POINTS_LOG_CHANNEL_ID?: string;
  VOICE_POINTS_AFK_CHANNEL_ID?: string;
  VOICE_POINTS_PER_MINUTE: number;
  VOICE_POINTS_GRANT_ROLE_IDS: string[];

  // AFK panel (optional; enabled when AFK_PANEL_CHANNEL_ID is set)
  AFK_PANEL_CHANNEL_ID?: string;
  AFK_LOG_CHANNEL_ID?: string;
  AFK_MAX_MINUTES: number; // default 12h

  // Twitch stream announcements (optional; enabled when TWITCH_ANNOUNCE_CHANNEL_ID is set)
  TWITCH_ANNOUNCE_CHANNEL_ID?: string;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  // Comma-separated twitch logins (e.g. "shroud,ninja"). Case-insensitive.
  TWITCH_STREAMERS: string[];
  // Optional mention (role id or @everyone/@here)
  TWITCH_ANNOUNCE_MENTION?: string;
  // Poll interval in seconds (default: 90)
  TWITCH_POLL_SECONDS: number;

  /** Рассылка `/rassylka`: ЛС участникам, у кого есть **хотя бы одна** из этих ролей. */
  BROADCAST_DM_TARGET_ROLE_IDS: string[];

  /** Рекрутеры: кому писать ЛС "обнаружена новая заявка". Если пусто — берём MODERATOR_ROLE_IDS. */
  RECRUITER_ROLE_IDS: string[];
};

export const config: Config = {
  DISCORD_TOKEN: mustGetEnv("DISCORD_TOKEN"),
  GUILD_ID: parseDiscordId("GUILD_ID"),
  CATEGORY_ID: parseDiscordId("CATEGORY_ID"),
  LOG_CHANNEL_ID: parseDiscordId("LOG_CHANNEL_ID"),
  PANEL_CHANNEL_ID: parseDiscordId("PANEL_CHANNEL_ID"),
  MODERATOR_ROLE_IDS: parseDiscordIdList("MODERATOR_ROLE_ID"),
  APPLICATIONS_BASE_PATH: mustGetEnv("APPLICATIONS_BASE_PATH"),

  WEEKLY_TICKETS_REPORT_CHANNEL_ID: parseDiscordIdOptional("WEEKLY_TICKETS_REPORT_CHANNEL_ID"),
  WEEKLY_TICKETS_REPORT_DOW: parseIntOptional("WEEKLY_TICKETS_REPORT_DOW") ?? 0,
  WEEKLY_TICKETS_REPORT_HOUR: parseIntOptional("WEEKLY_TICKETS_REPORT_HOUR") ?? 23,
  WEEKLY_TICKETS_REPORT_MINUTE: parseIntOptional("WEEKLY_TICKETS_REPORT_MINUTE") ?? 55,
  WEEKLY_TICKETS_TZ_OFFSET_MINUTES: parseIntOptional("WEEKLY_TICKETS_TZ_OFFSET_MINUTES") ?? 0,

  VOICE_POINTS_PANEL_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_PANEL_CHANNEL_ID"),
  VOICE_POINTS_LOG_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_LOG_CHANNEL_ID"),
  VOICE_POINTS_AFK_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_AFK_CHANNEL_ID"),
  VOICE_POINTS_PER_MINUTE: parseIntOptional("VOICE_POINTS_PER_MINUTE") ?? 1,
  VOICE_POINTS_GRANT_ROLE_IDS: parseDiscordIdListOptional("VOICE_POINTS_GRANT_ROLE_ID") ?? [],

  AFK_PANEL_CHANNEL_ID: parseDiscordIdOptional("AFK_PANEL_CHANNEL_ID"),
  AFK_LOG_CHANNEL_ID: parseDiscordIdOptional("AFK_LOG_CHANNEL_ID"),
  AFK_MAX_MINUTES: parseIntOptional("AFK_MAX_MINUTES") ?? 12 * 60,

  TWITCH_ANNOUNCE_CHANNEL_ID: parseDiscordIdOptional("TWITCH_ANNOUNCE_CHANNEL_ID"),
  TWITCH_CLIENT_ID: getEnvOptional("TWITCH_CLIENT_ID"),
  TWITCH_CLIENT_SECRET: getEnvOptional("TWITCH_CLIENT_SECRET"),
  TWITCH_STREAMERS: (getEnvOptional("TWITCH_STREAMERS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  TWITCH_ANNOUNCE_MENTION: getEnvOptional("TWITCH_ANNOUNCE_MENTION"),
  TWITCH_POLL_SECONDS: parseIntOptional("TWITCH_POLL_SECONDS") ?? 90,

  BROADCAST_DM_TARGET_ROLE_IDS: resolveBroadcastDmTargetRoleIds(),
  RECRUITER_ROLE_IDS: resolveRecruiterRoleIds(),
};

