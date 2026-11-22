import fs from "fs";

const TOKEN = process.env.TG_TOKEN;
const CHAT = process.env.TG_CHAT;
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const alerts = read("alerts.json", []);
const wl = read("watchlist.json", { movePercent: 3, symbols: [] });
const state = read("state.json", {});
let alertsChanged = false, stateChanged = false;

const send = (text) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text }),
  });

async function quote(sym) {
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const c = (await r.json()).chart.result[0];
  const closes = c.indicators.quote[0].close;
  const idx = [];
  closes.forEach((v, i) => { if (v != null) idx.push(i); });
  const last = idx[idx.length - 1], prevI = idx[idx.length - 2];
  return {
    price: c.meta.regularMarketPrice,
    prev: closes[prevI],
    day: new Date(c.timestamp[last] * 1000).toISOString().slice(0, 10),
  };
}

const cache = {};
const q = (s) => (cache[s] ??= quote(s));

// 1) Price level alerts
for (const a of alerts) {
  if (a.done) continue;
  try {
    const { price } = await q(a.symbol);
    const hit = a.cond === "above" ? price >= a.price : price <= a.price;
    console.log("level", a.symbol, price, hit ? "HIT" : "no");
    if (hit) {
      await send(`🔔 ${a.symbol} ab ${price.toFixed(2)} hai (${a.cond === "above" ? "upar gaya" : "neeche gaya"} ${a.price})`);
      a.done = true;
      alertsChanged = true;
    }
  } catch (e) { console.log("error", a.symbol, e.message); }
}

// 2) Daily percent-move alerts
for (const sym of wl.symbols) {
  try {
    const { price, prev, day } = await q(sym);
    const change = (price / prev - 1) * 100;
    console.log("move", sym, change.toFixed(2) + "%");
    if (Math.abs(change) >= wl.movePercent) {
      const dir = change > 0 ? "up" : "down";
      const key = `${sym}:${day}:${dir}`;
      if (!state[key]) {
        await send(`${change > 0 ? "📈" : "📉"} ${sym} aaj ${change > 0 ? "+" : ""}${change.toFixed(2)}% (${price.toFixed(2)})`);
        state[key] = 1;
        stateChanged = true;
      }
    }
  } catch (e) { console.log("error", sym, e.message); }
}

const keys = Object.keys(state);
if (keys.length > 300) { keys.slice(0, keys.length - 300).forEach((k) => delete state[k]); stateChanged = true; }

if (alertsChanged) fs.writeFileSync("alerts.json", JSON.stringify(alerts, null, 2));
if (stateChanged) fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
