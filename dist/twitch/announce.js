"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installTwitchAnnouncementsLoop = installTwitchAnnouncementsLoop;
const config_1 = require("../config");
const storage_1 = require("./storage");
function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
function mentionToContent(mention) {
    const t = (mention ?? "").trim();
    if (!t)
        return "";
    if (t === "@everyone" || t === "@here")
        return t;
    if (/^\d+$/.test(t))
        return `<@&${t}>`;
    return t;
}
async function getAppAccessToken() {
    if (!config_1.config.TWITCH_CLIENT_ID || !config_1.config.TWITCH_CLIENT_SECRET) {
        throw new Error("Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET");
    }
    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", config_1.config.TWITCH_CLIENT_ID);
    url.searchParams.set("client_secret", config_1.config.TWITCH_CLIENT_SECRET);
    url.searchParams.set("grant_type", "client_credentials");
    const resp = await fetch(url.toString(), { method: "POST" });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Twitch token request failed: ${resp.status} ${resp.statusText} ${text}`);
    }
    const json = (await resp.json());
    const expiresAtMs = Date.now() + Math.max(0, (json.expires_in ?? 0) - 60) * 1000; // refresh 1 min early
    return { token: json.access_token, expiresAtMs };
}
async function fetchLiveStreams(token, logins) {
    if (!config_1.config.TWITCH_CLIENT_ID)
        throw new Error("Missing TWITCH_CLIENT_ID");
    const url = new URL("https://api.twitch.tv/helix/streams");
    for (const login of logins)
        url.searchParams.append("user_login", login);
    const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "Client-ID": config_1.config.TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
        },
    });
    if (resp.status === 429) {
        // Rate limited – backoff a bit.
        await sleep(5_000);
    }
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Twitch streams request failed: ${resp.status} ${resp.statusText} ${text}`);
    }
    const json = (await resp.json());
    return json.data ?? [];
}
function installTwitchAnnouncementsLoop(client) {
    const channelId = config_1.config.TWITCH_ANNOUNCE_CHANNEL_ID;
    if (!channelId)
        return;
    if (!config_1.config.TWITCH_CLIENT_ID || !config_1.config.TWITCH_CLIENT_SECRET) {
        console.warn("[twitch] TWITCH_ANNOUNCE_CHANNEL_ID set but TWITCH_CLIENT_ID/SECRET missing; disabling.");
        return;
    }
    if (!config_1.config.TWITCH_STREAMERS || config_1.config.TWITCH_STREAMERS.length === 0) {
        console.warn("[twitch] TWITCH_ANNOUNCE_CHANNEL_ID set but TWITCH_STREAMERS empty; disabling.");
        return;
    }
    const pollMs = Math.max(20, config_1.config.TWITCH_POLL_SECONDS) * 1000;
    let tokenCache = null;
    async function getToken() {
        if (!tokenCache || Date.now() >= tokenCache.expiresAtMs) {
            tokenCache = await getAppAccessToken();
        }
        return tokenCache.token;
    }
    setInterval(async () => {
        try {
            const ch = await client.channels.fetch(channelId).catch(() => null);
            if (!ch || !ch.isTextBased())
                return;
            const text = ch;
            if (text.guild.id !== config_1.config.GUILD_ID)
                return;
            const token = await getToken();
            const live = await fetchLiveStreams(token, config_1.config.TWITCH_STREAMERS);
            const state = await (0, storage_1.readTwitchLiveState)();
            for (const s of live) {
                const login = (s.user_login ?? "").toLowerCase();
                if (!login)
                    continue;
                const lastId = state.lastAnnouncedStreamIdByLogin[login];
                if (lastId === s.id)
                    continue; // already announced this stream
                const url = `https://www.twitch.tv/${login}`;
                const mention = mentionToContent(config_1.config.TWITCH_ANNOUNCE_MENTION);
                const header = mention ? `${mention}\n` : "";
                const content = header +
                    `**${s.user_name}** запустил(а) стрим на Twitch!\n` +
                    `**Категория**: ${s.game_name || "—"}\n` +
                    `**Название**: ${s.title || "—"}\n` +
                    `${url}`;
                await text.send({ content }).catch(() => { });
                state.lastAnnouncedStreamIdByLogin[login] = s.id;
            }
            await (0, storage_1.writeTwitchLiveState)(state).catch(() => { });
        }
        catch (e) {
            // If network is flaky (as seen before), avoid noisy logs.
            const code = e?.code;
            if (code === "UND_ERR_CONNECT_TIMEOUT" || e?.name === "ConnectTimeoutError")
                return;
            console.error("[twitch] loop failed:", e);
            // If token expired/revoked unexpectedly, reset cache.
            if (String(e?.message ?? "").toLowerCase().includes("401"))
                tokenCache = null;
        }
    }, pollMs).unref?.();
}
