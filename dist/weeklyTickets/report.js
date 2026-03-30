"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installWeeklyTicketsReportLoop = installWeeklyTicketsReportLoop;
const config_1 = require("../config");
const weeklyTickets_1 = require("../storage/weeklyTickets");
function pad2(n) {
    return String(n).padStart(2, "0");
}
function formatLocalYmd(date) {
    const y = date.getUTCFullYear();
    const m = pad2(date.getUTCMonth() + 1);
    const d = pad2(date.getUTCDate());
    return `${d}.${m}.${y}`;
}
function withOffsetUtc(date, offsetMinutes) {
    return new Date(date.getTime() + offsetMinutes * 60_000);
}
// ISO week (Monday-based). Uses UTC getters on already offset-shifted Date.
function isoWeekKey(offsetDateUtc) {
    const d = new Date(Date.UTC(offsetDateUtc.getUTCFullYear(), offsetDateUtc.getUTCMonth(), offsetDateUtc.getUTCDate()));
    // Thursday in current week decides the year.
    const day = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}
function startOfIsoWeek(offsetDateUtc) {
    const d = new Date(Date.UTC(offsetDateUtc.getUTCFullYear(), offsetDateUtc.getUTCMonth(), offsetDateUtc.getUTCDate()));
    const day = d.getUTCDay() || 7; // 1..7
    d.setUTCDate(d.getUTCDate() - (day - 1)); // Monday
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
function endOfIsoWeek(startOfWeekUtc) {
    const d = new Date(startOfWeekUtc.getTime());
    d.setUTCDate(d.getUTCDate() + 6);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}
function shouldRunNow(offsetNowUtc) {
    const dow = offsetNowUtc.getUTCDay(); // 0..6 (Sun..Sat)
    return (dow === config_1.config.WEEKLY_TICKETS_REPORT_DOW &&
        offsetNowUtc.getUTCHours() === config_1.config.WEEKLY_TICKETS_REPORT_HOUR &&
        offsetNowUtc.getUTCMinutes() === config_1.config.WEEKLY_TICKETS_REPORT_MINUTE);
}
function installWeeklyTicketsReportLoop(client) {
    const reportChannelId = config_1.config.WEEKLY_TICKETS_REPORT_CHANNEL_ID;
    if (!reportChannelId)
        return;
    setInterval(async () => {
        try {
            const offsetNowUtc = withOffsetUtc(new Date(), config_1.config.WEEKLY_TICKETS_TZ_OFFSET_MINUTES);
            if (!shouldRunNow(offsetNowUtc))
                return;
            const weekKey = isoWeekKey(offsetNowUtc);
            const state = await (0, weeklyTickets_1.readWeeklyTicketsReportState)();
            if (state.lastPostedWeekKey === weekKey)
                return;
            const sow = startOfIsoWeek(offsetNowUtc);
            const eow = endOfIsoWeek(sow);
            const events = await (0, weeklyTickets_1.listWeeklyTicketEvents)().catch(() => []);
            const inWeek = events.filter((e) => {
                if (e.guildId !== config_1.config.GUILD_ID)
                    return false;
                const at = new Date(e.atIso);
                const offsetAtUtc = withOffsetUtc(at, config_1.config.WEEKLY_TICKETS_TZ_OFFSET_MINUTES);
                return offsetAtUtc.getTime() >= sow.getTime() && offsetAtUtc.getTime() <= eow.getTime();
            });
            const byMod = new Map();
            for (const ev of inWeek) {
                const agg = byMod.get(ev.moderatorUserId) ?? { accepted: 0, rejected: 0 };
                if (ev.decision === "accepted")
                    agg.accepted += 1;
                if (ev.decision === "rejected")
                    agg.rejected += 1;
                byMod.set(ev.moderatorUserId, agg);
            }
            const totalAccepted = Array.from(byMod.values()).reduce((s, a) => s + a.accepted, 0);
            const totalRejected = Array.from(byMod.values()).reduce((s, a) => s + a.rejected, 0);
            const total = totalAccepted + totalRejected;
            const lines = [];
            lines.push(`**Тикеты за неделю** (${formatLocalYmd(sow)} — ${formatLocalYmd(eow)})`);
            lines.push(`**Итого**: ${total} (принято: ${totalAccepted}, отклонено: ${totalRejected})`);
            lines.push("");
            const ranked = Array.from(byMod.entries())
                .map(([userId, a]) => ({ userId, ...a, handled: a.accepted + a.rejected }))
                .sort((x, y) => y.handled - x.handled || y.accepted - x.accepted);
            if (ranked.length === 0) {
                lines.push("За эту неделю обработанных тикетов нет.");
            }
            else {
                for (const r of ranked) {
                    lines.push(`- <@${r.userId}>: **${r.handled}** (принято: ${r.accepted}, отклонено: ${r.rejected})`);
                }
            }
            const ch = await client.channels.fetch(reportChannelId).catch(() => null);
            if (!ch || !ch.isTextBased())
                return;
            const text = ch;
            await text.send({ content: lines.join("\n") });
            await (0, weeklyTickets_1.writeWeeklyTicketsReportState)({ lastPostedWeekKey: weekKey }).catch(() => { });
        }
        catch (e) {
            console.error("[weeklyTickets:report] failed:", e);
        }
    }, 60_000).unref?.();
}
