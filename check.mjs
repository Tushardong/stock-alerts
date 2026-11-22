import fs from "fs";

const TOKEN = process.env.TG_TOKEN;
const CHAT = process.env.TG_CHAT;
const alerts = JSON.parse(fs.readFileSync("alerts.json", "utf8"));
let changed = false;

for (const a of alerts) {
  if (a.done) continue;
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${a.symbol}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const j = await r.json();
    const p = j.chart.result[0].meta.regularMarketPrice;
    const hit = a.cond === "above" ? p >= a.price : p <= a.price;
    console.log(a.symbol, p, hit ? "HIT" : "no");
    if (hit) {
      const text = `🔔 ${a.symbol} ab ${p} hai (${a.cond === "above" ? "upar gaya" : "neeche gaya"} ${a.price})`;
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT, text }),
      });
      a.done = true;
      changed = true;
    }
  } catch (e) {
    console.log("error", a.symbol, e.message);
  }
}

if (changed) fs.writeFileSync("alerts.json", JSON.stringify(alerts, null, 2));
