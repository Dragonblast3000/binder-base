#!/usr/bin/env node
/**
 * build-card-db.js
 * ----------------
 * Downloads the full YGOPRODeck card database once, trims each card to only
 * the fields Binder Forge uses, and writes a compact cards.json you can bundle
 * with the app for fully-offline search.
 *
 * Usage:
 *   node build-card-db.js
 *
 * Output:
 *   ./cards.json   (~3–5 MB, ~13k cards)
 *
 * Notes:
 *   - This hits the API ONCE. Re-run it occasionally (e.g. monthly) to refresh.
 *   - It does NOT download images. YGOPRODeck asks you to re-host images rather
 *     than hotlinking at volume — see the deployment guide for how to handle that.
 */

const fs = require("fs");
const https = require("https");

const URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

// Keep only what the app sorts/searches/displays on.
function trim(c) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    frameType: c.frameType,
    race: c.race,
    archetype: c.archetype || null,
    atk: typeof c.atk === "number" ? c.atk : null,
    def: typeof c.def === "number" ? c.def : null,
    level: typeof c.level === "number" ? c.level : null,
    attribute: c.attribute || null,
  };
}

(async () => {
  console.log("Downloading full card database from YGOPRODeck…");
  const data = await fetchJSON(URL);
  const cards = (data.data || []).map(trim);
  console.log(`Got ${cards.length} cards. Trimming and writing cards.json…`);

  // Write compact (no whitespace) to keep the bundle small.
  fs.writeFileSync("cards.json", JSON.stringify(cards));
  const mb = (fs.statSync("cards.json").size / 1e6).toFixed(2);
  console.log(`Done → cards.json (${mb} MB)`);

  // Optional: also emit a list of every image URL, so you can batch-download
  // and re-host the art per YGOPRODeck's terms.
  const urls = cards.map((c) => `https://images.ygoprodeck.com/images/cards_small/${c.id}.jpg`);
  fs.writeFileSync("image-urls.txt", urls.join("\n"));
  console.log(`Also wrote image-urls.txt (${urls.length} URLs) for re-hosting.`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
