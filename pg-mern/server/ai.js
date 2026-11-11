// AI layer: (1) statistics for anomaly/forecast/risk, (2) optional LLM-written reminders.
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const thisMonth = () => new Date().toISOString().slice(0, 7);

// A bill counts as "late" if an earlier month is still unpaid, or it was paid after the 5th.
export const lateCount = (bs) =>
  bs.filter((b) => (b.month < thisMonth() && b.status !== "paid") || (b.paidAt && new Date(b.paidAt).getDate() > 5)).length;

export function analyze(room, bs, rate) {
  const cur = bs[bs.length - 1];
  const hist = bs.slice(0, -1).map((b) => b.units);
  const m = mean(hist), sd = Math.sqrt(mean(hist.map((u) => (u - m) ** 2)));
  const pct = m ? Math.round(((cur.units - m) / m) * 100) : 0;
  const late = lateCount(bs);
  return {
    units: cur.units, avg: Math.round(m), pct, status: cur.status, late,
    anomaly: hist.length >= 3 && cur.units > m + Math.max(1.5 * sd, 5) && pct > 20,
    extra: Math.max(0, Math.round((cur.units - m) * rate)),
    forecast: Math.round(room.rent + mean([...hist.slice(-3), cur.units]) * rate),
    risk: late * 2 + (cur.status === "paid" ? 0 : 3),
  };
}

export async function reminderText({ name, pg, number, units, total, month, late, tone, lang }) {
  const t = tone === "auto" || !tone ? (late >= 2 ? "firm" : "gentle") : tone;
  const first = name.split(" ")[0], amt = "₹" + total.toLocaleString("en-IN");
  const fallback = lang === "english"
    ? t === "firm"
      ? `Hello ${first}, ${pg} Room ${number}: ${amt} for ${month} (${units} units) is pending and payments have been late ${late} times. Please pay today. Thank you.`
      : `Hi ${first}, ${pg} here. Your ${month} rent + electricity (${units} units) is ${amt}. Please pay by the 5th. Thank you!`
    : t === "firm"
      ? `Namaste ${first}ji, ${pg} Room ${number}: ${month} ka ${amt} (${units} units) abhi tak baaki hai aur pichle ${late} baar late hua hai. Kripya aaj hi bhej dein. Dhanyavaad.`
      : `Namaste ${first}ji 🙏 ${pg} se. Room ${number} ka ${month} rent + bijli (${units} units) ${amt} ready hai. Kripya 5 tareekh tak bhej dein. Dhanyavaad!`;
  if (!process.env.ANTHROPIC_API_KEY) return { text: fallback, source: "template" };
  try {
    const prompt = `Write a short WhatsApp rent reminder (max 60 words, ${lang === "english" ? "English" : "Hinglish"}, ${t} tone, one emoji at most) from a PG owner to tenant ${first}. Room ${number}, month ${month}, ${units} electricity units, total ${amt}, due by the 5th, paid late ${late} times before. Return only the message.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    const text = d.content?.[0]?.text?.trim();
    return text ? { text, source: "ai" } : { text: fallback, source: "template" };
  } catch {
    return { text: fallback, source: "template" };
  }
}
