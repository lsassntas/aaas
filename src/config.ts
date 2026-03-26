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

export type Config = {
  DISCORD_TOKEN: string;
  GUILD_ID: string;
  CATEGORY_ID: string;
  LOG_CHANNEL_ID: string;
  PANEL_CHANNEL_ID: string;
  MODERATOR_ROLE_IDS: string[];
  APPLICATIONS_BASE_PATH: string;

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
};

export const config: Config = {
  DISCORD_TOKEN: mustGetEnv("DISCORD_TOKEN"),
  GUILD_ID: parseDiscordId("GUILD_ID"),
  CATEGORY_ID: parseDiscordId("CATEGORY_ID"),
  LOG_CHANNEL_ID: parseDiscordId("LOG_CHANNEL_ID"),
  PANEL_CHANNEL_ID: parseDiscordId("PANEL_CHANNEL_ID"),
  MODERATOR_ROLE_IDS: parseDiscordIdList("MODERATOR_ROLE_ID"),
  APPLICATIONS_BASE_PATH: mustGetEnv("APPLICATIONS_BASE_PATH"),

  VOICE_POINTS_PANEL_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_PANEL_CHANNEL_ID"),
  VOICE_POINTS_LOG_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_LOG_CHANNEL_ID"),
  VOICE_POINTS_AFK_CHANNEL_ID: parseDiscordIdOptional("VOICE_POINTS_AFK_CHANNEL_ID"),
  VOICE_POINTS_PER_MINUTE: parseIntOptional("VOICE_POINTS_PER_MINUTE") ?? 1,
  VOICE_POINTS_GRANT_ROLE_IDS: parseDiscordIdListOptional("VOICE_POINTS_GRANT_ROLE_ID") ?? [],

  AFK_PANEL_CHANNEL_ID: parseDiscordIdOptional("AFK_PANEL_CHANNEL_ID"),
  AFK_LOG_CHANNEL_ID: parseDiscordIdOptional("AFK_LOG_CHANNEL_ID"),
  AFK_MAX_MINUTES: parseIntOptional("AFK_MAX_MINUTES") ?? 12 * 60,
};

