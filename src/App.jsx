import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, X, Printer, BookOpen, Settings, ArrowLeft, Layers, Loader2, Wand2, Copy, GripVertical } from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   DATA LAYER
   Live lookups hit the YGOPRODeck API. The artifact sandbox often blocks
   external fetches, so searchCards falls back to a small bundled sample
   set. For a real/offline app, replace `searchCards` with a lookup over
   the full DB JSON (one cardinfo.php call ≈ 13k cards) and serve images
   from a local/cached pack — nothing else changes.
   ════════════════════════════════════════════════════════════════════ */
const API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

function normalize(c) {
  return {
    id: c.id, name: c.name, type: c.type, frameType: c.frameType, race: c.race,
    archetype: c.archetype || null,
    atk: typeof c.atk === "number" ? c.atk : null,
    def: typeof c.def === "number" ? c.def : null,
    level: typeof c.level === "number" ? c.level : null,
    attribute: c.attribute || null,
  };
}

// Bundled offline sample — real cards/IDs, used when the API is unreachable.
const SAMPLE = [
  { id: 14558127, name: "Ash Blossom & Joyous Spring", type: "Effect Monster", frameType: "effect", race: "Zombie", archetype: null, atk: 0, def: 1800, level: 3, attribute: "FIRE" },
  { id: 23434538, name: "Maxx \"C\"", type: "Effect Monster", frameType: "effect", race: "Insect", archetype: null, atk: 500, def: 200, level: 2, attribute: "EARTH" },
  { id: 10045474, name: "Ghost Belle & Haunted Mansion", type: "Effect Monster", frameType: "effect", race: "Zombie", archetype: null, atk: 0, def: 1800, level: 3, attribute: "FIRE" },
  { id: 38814750, name: "Dark Magician", type: "Normal Monster", frameType: "normal", race: "Spellcaster", archetype: "Dark Magician", atk: 2500, def: 2100, level: 7, attribute: "DARK" },
  { id: 36996508, name: "Dark Magician Girl", type: "Effect Monster", frameType: "effect", race: "Spellcaster", archetype: "Dark Magician", atk: 2000, def: 1700, level: 6, attribute: "DARK" },
  { id: 89631139, name: "Blue-Eyes White Dragon", type: "Normal Monster", frameType: "normal", race: "Dragon", archetype: "Blue-Eyes", atk: 3000, def: 2500, level: 8, attribute: "LIGHT" },
  { id: 38517737, name: "Blue-Eyes Alternative White Dragon", type: "Effect Monster", frameType: "effect", race: "Dragon", archetype: "Blue-Eyes", atk: 3000, def: 2500, level: 8, attribute: "LIGHT" },
  { id: 70368879, name: "Snake-Eye Ash", type: "Effect Monster", frameType: "effect", race: "Pyro", archetype: "Snake-Eye", atk: 800, def: 1000, level: 1, attribute: "FIRE" },
  { id: 9674034, name: "Snake-Eyes Flamberge Dragon", type: "Effect Monster", frameType: "effect", race: "Dragon", archetype: "Snake-Eye", atk: 3000, def: 2500, level: 8, attribute: "FIRE" },
  { id: 27204311, name: "Diabellstar the Black Witch", type: "Effect Monster", frameType: "effect", race: "Spellcaster", archetype: null, atk: 2500, def: 2000, level: 7, attribute: "DARK" },
  { id: 18144506, name: "Effect Veiler", type: "Effect Monster", frameType: "effect", race: "Spellcaster", archetype: null, atk: 0, def: 0, level: 1, attribute: "LIGHT" },
  { id: 40640057, name: "Kuriboh", type: "Effect Monster", frameType: "effect", race: "Fiend", archetype: "Kuriboh", atk: 300, def: 200, level: 1, attribute: "DARK" },
  { id: 5318639, name: "Pot of Greed", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 70368879, name: "WANTED: Seeker of Sinful Spoils", type: "Spell Card", frameType: "spell", race: "Normal", archetype: "Sinful Spoils", atk: null, def: null, level: null, attribute: null },
  { id: 24224830, name: "Called by the Grave", type: "Spell Card", frameType: "spell", race: "Quick-Play", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 53129443, name: "Dark Hole", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 97268402, name: "Mystical Space Typhoon", type: "Spell Card", frameType: "spell", race: "Quick-Play", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 31833038, name: "Mound of the Bound Creator", type: "Spell Card", frameType: "spell", race: "Field", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 8949584, name: "Continuous: Royal Magical Library", type: "Spell Card", frameType: "spell", race: "Continuous", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 44095762, name: "Mirror Force", type: "Trap Card", frameType: "trap", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 4178474, name: "Solemn Judgment", type: "Trap Card", frameType: "trap", race: "Counter", archetype: "Solemn", atk: null, def: null, level: null, attribute: null },
  { id: 41420027, name: "Solemn Warning", type: "Trap Card", frameType: "trap", race: "Counter", archetype: "Solemn", atk: null, def: null, level: null, attribute: null },
  { id: 18144507, name: "Skill Drain", type: "Trap Card", frameType: "trap", race: "Continuous", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 19613556, name: "Heavy Storm", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 83764718, name: "Monster Reborn", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 12580477, name: "Raigeki", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 53582587, name: "Infinite Impermanence", type: "Trap Card", frameType: "trap", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
];

let API_OK = true;        // flips false if the live API is unreachable
let CARD_DB = null;       // bundled full database, loaded once from /cards.json
let DB_TRIED = false;     // so we only attempt the fetch a single time

// Tries the bundled local DB first (instant, offline). If you haven't run
// build-card-db.js yet, it falls back to the live API, then to the sample set.
async function ensureDB() {
  if (CARD_DB || DB_TRIED) return CARD_DB;
  DB_TRIED = true;
  try {
    const r = await fetch("/cards.json");
    if (r.ok) { CARD_DB = await r.json(); }
  } catch { /* no bundled DB yet — that's fine */ }
  return CARD_DB;
}

async function searchCards(term) {
  const q = term.trim().toLowerCase();
  if (!q) return [];

  // 1) Bundled local database (preferred once you've built cards.json)
  const db = await ensureDB();
  if (db) return db.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 60);

  // 2) Live API
  if (API_OK) {
    try {
      const r = await fetch(`${API}?fname=${encodeURIComponent(term)}&num=60&offset=0`);
      if (r.ok) { const d = await r.json(); return (d.data || []).slice(0, 60).map(normalize); }
      if (r.status === 400) return [];
      throw new Error("bad status");
    } catch { API_OK = false; }
  }

  // 3) Built-in sample (last resort)
  return SAMPLE.filter((c) => c.name.toLowerCase().includes(q));
}

const imgUrl = (id) => `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`;

/* ════════════════════════════════════════════════════════════════════
   CONFIGURABLE AUTO-ORGANISE
   The user assembles an ordered list of rules. Cards are sorted by the
   first rule, ties broken by the second, and so on. "Type bucket" and
   "Archetype group" are the structural ones; the rest are tie-breakers.
   ════════════════════════════════════════════════════════════════════ */
function categoryOf(card) {
  const t = (card.type || "").toLowerCase();
  if (t.includes("spell")) return "spell";
  if (t.includes("trap")) return "trap";
  return "monster";
}
const SPELL_ORDER = ["normal", "quick-play", "continuous", "ritual", "equip", "field"];
const TRAP_ORDER = ["normal", "continuous", "counter"];
function subRank(card, order) {
  const race = (card.race || "").toLowerCase();
  const i = order.findIndex((k) => race.includes(k));
  return i === -1 ? order.length : i;
}

// Every available rule and how it compares two cards.
const RULES = {
  typeBucket:   { label: "Type (Monster → Spell → Trap)", cmp: (a, b) => ({ monster: 0, spell: 1, trap: 2 }[categoryOf(a)] - { monster: 0, spell: 1, trap: 2 }[categoryOf(b)]) },
  archetype:    { label: "Group same archetype",          cmp: (a, b) => (a.archetype || "~" + a.name).localeCompare(b.archetype || "~" + b.name) },
  level:        { label: "Monster level (high → low)",     cmp: (a, b) => (b.level || -1) - (a.level || -1) },
  atk:          { label: "ATK (high → low)",               cmp: (a, b) => (b.atk || -1) - (a.atk || -1) },
  def:          { label: "DEF (high → low)",               cmp: (a, b) => (b.def || -1) - (a.def || -1) },
  attribute:    { label: "Attribute (A → Z)",              cmp: (a, b) => (a.attribute || "").localeCompare(b.attribute || "") },
  spellTrapSub: { label: "Spell/Trap subtype order",       cmp: (a, b) => {
                    const ca = categoryOf(a), cb = categoryOf(b);
                    if (ca !== cb) return 0; // only meaningful within same s/t group
                    if (ca === "spell") return subRank(a, SPELL_ORDER) - subRank(b, SPELL_ORDER);
                    if (ca === "trap") return subRank(a, TRAP_ORDER) - subRank(b, TRAP_ORDER);
                    return 0;
                  } },
  name:         { label: "Name (A → Z)",                   cmp: (a, b) => (a.name || "").localeCompare(b.name || "") },
};
const DEFAULT_RULES = ["typeBucket", "archetype", "level", "atk", "def", "spellTrapSub", "name"];

function organiseBy(cards, ruleIds) {
  const active = ruleIds.filter((id) => RULES[id]);
  return [...cards].sort((a, b) => {
    for (const id of active) { const r = RULES[id].cmp(a, b); if (r) return r; }
    return 0;
  });
}

/* ── Persistence (localStorage — per browser, no server needed) ────── */
const KEY = "ygo:binders";
function loadBinders() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function saveBinders(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { console.error(e); } }

/* ── Layouts & model ──────────────────────────────────────────────── */
const LAYOUTS = [
  { id: "3x3", cols: 3, rows: 3, label: "3 × 3" },
  { id: "4x3", cols: 4, rows: 3, label: "4 × 3" },
  { id: "4x4", cols: 4, rows: 4, label: "4 × 4" },
  { id: "2x2", cols: 2, rows: 2, label: "2 × 2" },
];
const uid = () => Math.random().toString(36).slice(2, 10);
function newBinder(name, layoutId, pages) {
  const l = LAYOUTS.find((x) => x.id === layoutId) || LAYOUTS[0];
  const per = l.cols * l.rows;
  return { id: uid(), name, layoutId, organiseRules: [...DEFAULT_RULES], pages: Array.from({ length: pages }, () => Array(per).fill(null)) };
}

/* ── Theme ────────────────────────────────────────────────────────── */
const C = { bg: "#0e0f13", panel: "#16181f", panel2: "#1d2029", border: "#2a2e3a", accent: "#c8a04a", text: "#e8e8ec", sub: "#8a8f9c", danger: "#c45a5a" };
const font = `"Trebuchet MS","Segoe UI",system-ui,sans-serif`;

// Attribute → tint for the placeholder card face (when image is blocked).
const ATTR_TINT = { DARK: "#3a2a4a", LIGHT: "#caa94a", FIRE: "#a33a28", WATER: "#2a5aa3", EARTH: "#6a5a3a", WIND: "#2a8a5a", DIVINE: "#b08a2a", spell: "#1a7a6a", trap: "#9a2a6a" };

/* ═══════════════════════════════════════════════════════════════════ */
export default function BinderApp() {
  const [binders, setBinders] = useState([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => { setBinders(loadBinders()); setReady(true); }, []);
  const persist = useCallback((next) => { setBinders(next); saveBinders(next); }, []);
  const active = binders.find((b) => b.id === activeId);

  if (!ready) return (
    <div style={{ minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.sub, fontFamily: font }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 10 }} /> Loading your binders…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: font, minHeight: 560, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}`, position: "relative" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ygo-scroll::-webkit-scrollbar{width:8px;height:8px}.ygo-scroll::-webkit-scrollbar-thumb{background:${C.border};border-radius:8px}
        .ygo-slot{transition:transform .12s,box-shadow .12s,border-color .12s}.ygo-slot:hover{border-color:${C.accent}!important}
        .ygo-btn{transition:all .12s;cursor:pointer}.ygo-btn:hover{filter:brightness(1.12)}.ygo-btn:active{transform:scale(.97)}
      `}</style>
      {active ? (
        <BinderView binder={active} onBack={() => setActiveId(null)}
          onUpdate={(u) => persist(binders.map((b) => (b.id === u.id ? u : b)))} />
      ) : (
        <Library binders={binders} onOpen={setActiveId}
          onCreate={(b) => { persist([...binders, b]); setActiveId(b.id); }}
          onDelete={(id) => persist(binders.filter((b) => b.id !== id))} />
      )}
    </div>
  );
}

/* ── Card face: tries real image, falls back to styled placeholder ── */
function CardFace({ card, style }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    const cat = categoryOf(card);
    const tint = cat === "monster" ? (ATTR_TINT[card.attribute] || "#444") : ATTR_TINT[cat];
    return (
      <div style={{ width: "100%", height: "100%", background: tint, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "6%", boxSizing: "border-box", ...style }}>
        <div style={{ fontSize: "min(2.6vw,11px)", fontWeight: 700, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>{card.name}</div>
        <div style={{ fontSize: "min(2.2vw,9px)", color: "rgba(255,255,255,.85)", textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
          {cat === "monster" ? `Lv${card.level ?? "-"} · ${card.atk ?? "?"}/${card.def ?? "?"}` : `${card.race || ""} ${cat}`}
        </div>
      </div>
    );
  }
  return <img src={imgUrl(card.id)} alt={card.name} onError={() => setBroken(true)} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />;
}

/* ═══════════════════════════════════════════════════════════════════ */
function Library({ binders, onOpen, onCreate, onDelete }) {
  const [creating, setCreating] = useState(false);
  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Layers size={26} color={C.accent} />
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0.5, fontWeight: 600 }}>Binder Base</h1>
        </div>
        <button className="ygo-btn" onClick={() => setCreating(true)} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 7 }}><Plus size={17} /> New binder</button>
      </div>
      <p style={{ color: C.sub, marginTop: 4, marginBottom: 26, fontSize: 14 }}>Design your card layouts, then print cut-out placeholders for the real thing.</p>
      {binders.length === 0 ? (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "56px 20px", textAlign: "center", color: C.sub }}>
          <BookOpen size={40} color={C.border} />
          <p style={{ marginTop: 14, fontSize: 15 }}>No binders yet. Create your first one to get started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {binders.map((b) => {
            const l = LAYOUTS.find((x) => x.id === b.layoutId) || LAYOUTS[0];
            const filled = b.pages.flat().filter(Boolean).length;
            const total = b.pages.length * l.cols * l.rows;
            return (
              <div key={b.id} className="ygo-slot" onClick={() => onOpen(b.id)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: "pointer", animation: "fade .25s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <BookOpen size={22} color={C.accent} />
                  <button className="ygo-btn" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${b.name}"?`)) onDelete(b.id); }} style={{ background: "transparent", border: "none", color: C.sub, padding: 4 }}><Trash2 size={16} /></button>
                </div>
                <h3 style={{ margin: "12px 0 4px", fontSize: 17, fontWeight: 600 }}>{b.name}</h3>
                <div style={{ color: C.sub, fontSize: 13 }}>{l.label} · {b.pages.length} {b.pages.length === 1 ? "page" : "pages"}</div>
                <div style={{ marginTop: 12, height: 6, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total ? (filled / total) * 100 : 0}%`, background: C.accent }} />
                </div>
                <div style={{ color: C.sub, fontSize: 12, marginTop: 6 }}>{filled} / {total} slots filled</div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={(b) => { onCreate(b); setCreating(false); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [layoutId, setLayoutId] = useState("3x3");
  const [pages, setPages] = useState(8);
  return (
    <Overlay onClose={onClose}>
      <div style={modalBox(420)} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalH}>New binder</h2>
        <Label>Name</Label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="My trade binder" style={inputStyle} />
        <Label>Page layout</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
          {LAYOUTS.map((l) => <Toggle key={l.id} active={layoutId === l.id} onClick={() => setLayoutId(l.id)}>{l.label}</Toggle>)}
        </div>
        <Label>Number of pages</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <input type="range" min={1} max={40} value={pages} onChange={(e) => setPages(+e.target.value)} style={{ flex: 1, accentColor: C.accent }} />
          <span style={{ width: 34, textAlign: "center", fontWeight: 700, fontSize: 16 }}>{pages}</span>
        </div>
        <Row>
          <button className="ygo-btn" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button className="ygo-btn" disabled={!name.trim()} onClick={() => onCreate(newBinder(name.trim(), layoutId, pages))} style={{ ...primaryBtn, opacity: name.trim() ? 1 : 0.4 }}>Create</button>
        </Row>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function BinderView({ binder, onBack, onUpdate }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [tray, setTray] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showOrganise, setShowOrganise] = useState(false);

  const layout = LAYOUTS.find((l) => l.id === binder.layoutId) || LAYOUTS[0];
  const perPage = layout.cols * layout.rows;
  const page = binder.pages[pageIdx] || [];
  const rules = binder.organiseRules || DEFAULT_RULES;

  const writePage = (mut) => onUpdate({ ...binder, pages: binder.pages.map((p, i) => (i === pageIdx ? mut(p) : p)) });
  const setCard = (slot, card) => writePage((p) => p.map((c, j) => (j === slot ? card : c)));

  const addPage = () => onUpdate({ ...binder, pages: [...binder.pages, Array(perPage).fill(null)] });
  const removePage = () => {
    if (binder.pages.length <= 1) return;
    const pages = binder.pages.filter((_, i) => i !== pageIdx);
    onUpdate({ ...binder, pages });
    setPageIdx((i) => Math.max(0, Math.min(i, pages.length - 1)));
  };

  const placeFromTray = (slot) => {
    if (!tray.length) return;
    const [head, ...rest] = tray;
    setCard(slot, head); setTray(rest);
  };

  const runOrganise = (ruleIds) => {
    const all = [...binder.pages.flat().filter(Boolean), ...tray];
    const sorted = organiseBy(all, ruleIds);
    const pages = [];
    for (let i = 0; i < sorted.length; i += perPage) {
      const chunk = sorted.slice(i, i + perPage);
      while (chunk.length < perPage) chunk.push(null);
      pages.push(chunk);
    }
    if (!pages.length) pages.push(Array(perPage).fill(null));
    onUpdate({ ...binder, organiseRules: ruleIds, pages });
    setTray([]); setPageIdx(0); setShowOrganise(false);
  };

  const armed = tray.length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.border}`, background: C.panel, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button className="ygo-btn" onClick={onBack} style={{ background: "transparent", border: "none", color: C.text, display: "flex", alignItems: "center", gap: 5, fontFamily: font, fontSize: 14 }}><ArrowLeft size={18} /> Library</button>
          <div style={{ width: 1, height: 22, background: C.border }} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{binder.name}</h2>
          <span style={{ color: C.sub, fontSize: 13 }}>{layout.label}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ygo-btn" onClick={() => setPicker(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}><Plus size={16} /> Add cards</button>
          <button className="ygo-btn" onClick={() => setShowOrganise(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}><Wand2 size={16} /> Auto-organise</button>
          <button className="ygo-btn" onClick={() => setShowSettings(true)} style={iconBtn}><Settings size={17} /></button>
          <button className="ygo-btn" onClick={() => setShowPrint(true)} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 7, padding: "9px 15px" }}><Printer size={16} /> Print</button>
        </div>
      </div>

      {armed && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", background: C.panel2, borderBottom: `1px solid ${C.border}`, animation: "fade .2s ease" }}>
          <span style={{ fontSize: 13, color: C.accent, fontWeight: 700, whiteSpace: "nowrap" }}>Placing:</span>
          <div className="ygo-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
            {tray.map((c, i) => (
              <div key={i} style={{ height: 52, width: 36, flex: "0 0 auto", borderRadius: 4, overflow: "hidden", opacity: i === 0 ? 1 : 0.45, border: i === 0 ? `2px solid ${C.accent}` : "none" }} title={c.name}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12.5, color: C.sub, whiteSpace: "nowrap" }}>{tray.length} left · click a slot</span>
          <button className="ygo-btn" onClick={() => setTray([])} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12.5 }}>Clear</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 0 4px" }}>
        <button className="ygo-btn" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => i - 1)} style={{ ...navBtn, opacity: pageIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={20} /></button>
        <span style={{ fontSize: 14, color: C.sub }}>Page <b style={{ color: C.text }}>{pageIdx + 1}</b> of {binder.pages.length}</span>
        <button className="ygo-btn" disabled={pageIdx >= binder.pages.length - 1} onClick={() => setPageIdx((i) => i + 1)} style={{ ...navBtn, opacity: pageIdx >= binder.pages.length - 1 ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "12px 24px 30px" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${layout.cols},1fr)`, gap: 12, width: "100%", maxWidth: layout.cols * 130 }}>
          {Array.from({ length: perPage }).map((_, slot) => {
            const card = page[slot];
            return (
              <div key={slot} className="ygo-slot" onClick={() => { if (armed) placeFromTray(slot); else setPicker(true); }}
                style={{ position: "relative", aspectRatio: "59/86", borderRadius: 9, cursor: "pointer", overflow: "hidden",
                  background: card ? "transparent" : C.panel2,
                  border: `1.5px ${card ? "solid" : "dashed"} ${card ? C.accent : armed ? C.accent : C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card ? (
                  <>
                    <CardFace card={card} />
                    <button className="ygo-btn" onClick={(e) => { e.stopPropagation(); setCard(slot, null); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.65)", border: "none", color: "#fff", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                  </>
                ) : (
                  <Plus size={22} color={armed ? C.accent : C.border} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {picker && <CardPicker onClose={() => setPicker(false)} onAdd={(cards) => { setTray((t) => [...t, ...cards]); setPicker(false); }} />}
      {showSettings && <SettingsModal binder={binder} layout={layout} onClose={() => setShowSettings(false)} onAddPage={addPage} onRemovePage={removePage} onRename={(n) => onUpdate({ ...binder, name: n })} />}
      {showPrint && <PrintModal binder={binder} layout={layout} onClose={() => setShowPrint(false)} />}
      {showOrganise && <OrganiseModal initialRules={rules} count={binder.pages.flat().filter(Boolean).length + tray.length} onClose={() => setShowOrganise(false)} onRun={runOrganise} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function CardPicker({ onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [basket, setBasket] = useState([]);
  const timer = useRef(null);

  const run = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); setEmpty(false); return; }
    setLoading(true);
    const cards = await searchCards(term);
    setOffline(!API_OK);
    setResults(cards); setEmpty(cards.length === 0); setLoading(false);
  }, []);
  useEffect(() => { clearTimeout(timer.current); timer.current = setTimeout(() => run(q), 350); return () => clearTimeout(timer.current); }, [q, run]);

  const addToBasket = (card) => setBasket((b) => {
    const ex = b.find((x) => x.card.id === card.id && x.card.name === card.name);
    if (ex) return b.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x));
    return [...b, { card, qty: 1 }];
  });
  const setQty = (card, qty) => setBasket((b) => qty <= 0 ? b.filter((x) => x.card !== card) : b.map((x) => (x.card === card ? { ...x, qty } : x)));
  const total = basket.reduce((n, x) => n + x.qty, 0);
  const confirm = () => { const out = []; basket.forEach(({ card, qty }) => { for (let i = 0; i < qty; i++) out.push(card); }); onAdd(out); };

  return (
    <Overlay onClose={onClose}>
      <div style={{ width: 620, maxWidth: "94vw", height: 600, maxHeight: "88vh", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add cards</h2>
            <button className="ygo-btn" onClick={onClose} style={iconBtn}><X size={17} /></button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={16} color={C.sub} style={{ position: "absolute", left: 12, top: 11 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by card name… (click a card to add a copy)" style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
          </div>
          {offline && !CARD_DB && <div style={{ marginTop: 8, fontSize: 12, color: C.accent }}>Using built-in sample set. Run build-card-db.js and add cards.json to /public for the full database.</div>}
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div className="ygo-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, borderRight: `1px solid ${C.border}` }}>
            {loading && <Center><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></Center>}
            {!loading && empty && <Center>No matches{offline ? " in the sample set. Try Ash, Dark Magician, Blue-Eyes, Solemn…" : "."}</Center>}
            {!loading && !q && <Center>Start typing to search.</Center>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 10 }}>
              {results.map((c, i) => (
                <div key={c.id + "-" + i} className="ygo-slot" onClick={() => addToBasket(c)} title={c.name}
                  style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, background: C.panel2, aspectRatio: "59/86", animation: "fade .2s ease" }}>
                  <CardFace card={c} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: 230, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px 8px", fontSize: 13, color: C.sub, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>Selected · {total} {total === 1 ? "copy" : "copies"}</div>
            <div className="ygo-scroll" style={{ flex: 1, overflowY: "auto", padding: 10 }}>
              {!basket.length && <div style={{ color: C.sub, fontSize: 13, textAlign: "center", padding: "30px 8px", lineHeight: 1.5 }}>Click cards on the left to build your stack, then set how many copies of each.</div>}
              {basket.map(({ card, qty }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 30, height: 44, borderRadius: 3, overflow: "hidden", flex: "0 0 auto" }}><CardFace card={card} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.name}</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button className="ygo-btn" onClick={() => setQty(card, qty - 1)} style={qtyBtn}>−</button>
                    <span style={{ width: 18, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{qty}</span>
                    <button className="ygo-btn" onClick={() => setQty(card, qty + 1)} style={qtyBtn}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
              <button className="ygo-btn" disabled={!total} onClick={confirm} style={{ ...primaryBtn, width: "100%", opacity: total ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Copy size={15} /> Add {total || ""} to place
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ORGANISE MODAL — pick & order the rules. Drag the handle to reorder,
   toggle the checkbox to include/exclude. Sort runs top → bottom.
   ═══════════════════════════════════════════════════════════════════ */
function OrganiseModal({ initialRules, count, onClose, onRun }) {
  // active = ordered enabled rules; inactive = available but off
  const [active, setActive] = useState(initialRules.filter((id) => RULES[id]));
  const inactive = Object.keys(RULES).filter((id) => !active.includes(id));
  const [drag, setDrag] = useState(null);

  const move = (from, to) => setActive((a) => { const n = [...a]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  const enable = (id) => setActive((a) => [...a, id]);
  const disable = (id) => setActive((a) => a.filter((x) => x !== id));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...modalBox(460), maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Wand2 size={22} color={C.accent} /><h2 style={{ ...modalH, margin: 0 }}>Auto-organise</h2>
        </div>
        <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.55, margin: "0 0 16px" }}>
          Sorting all <b style={{ color: C.text }}>{count}</b> cards. Drag to set priority — earlier rules win, later ones break ties. Toggle any rule off to ignore it.
        </p>

        <div className="ygo-scroll" style={{ overflowY: "auto", flex: 1, marginBottom: 4 }}>
          <Label>Active rules (in order)</Label>
          <div style={{ marginBottom: 14 }}>
            {active.map((id, idx) => (
              <div key={id} draggable
                onDragStart={() => setDrag(idx)}
                onDragOver={(e) => { e.preventDefault(); if (drag !== null && drag !== idx) { move(drag, idx); setDrag(idx); } }}
                onDragEnd={() => setDrag(null)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, background: C.panel2, border: `1px solid ${drag === idx ? C.accent : C.border}`, borderRadius: 8, cursor: "grab" }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: C.accent, color: "#1a1408", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{idx + 1}</span>
                <GripVertical size={15} color={C.sub} />
                <span style={{ flex: 1, fontSize: 13.5 }}>{RULES[id].label}</span>
                <button className="ygo-btn" onClick={() => disable(id)} style={{ background: "transparent", border: "none", color: C.sub, padding: 2 }}><X size={15} /></button>
              </div>
            ))}
            {!active.length && <div style={{ color: C.sub, fontSize: 13, padding: "10px 0" }}>No rules — cards keep current order.</div>}
          </div>

          {inactive.length > 0 && <>
            <Label>Add a rule</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {inactive.map((id) => (
                <button key={id} className="ygo-btn" onClick={() => enable(id)}
                  style={{ background: "transparent", color: C.text, border: `1px dashed ${C.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12.5, fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
                  <Plus size={13} /> {RULES[id].label}
                </button>
              ))}
            </div>
          </>}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <button className="ygo-btn" onClick={() => setActive([...DEFAULT_RULES])} style={{ ...ghostBtn, fontSize: 12.5, padding: "8px 12px" }}>Reset to default</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ygo-btn" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button className="ygo-btn" disabled={!count} onClick={() => onRun(active)} style={{ ...primaryBtn, opacity: count ? 1 : 0.4, display: "flex", alignItems: "center", gap: 7 }}><Wand2 size={15} /> Organise</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function SettingsModal({ binder, layout, onClose, onAddPage, onRemovePage, onRename }) {
  const [name, setName] = useState(binder.name);
  return (
    <Overlay onClose={onClose}>
      <div style={modalBox(380)} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalH}>Binder settings</h2>
        <Label>Name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && onRename(name.trim())} style={inputStyle} />
        <Label>Pages — currently {binder.pages.length}</Label>
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <button className="ygo-btn" onClick={onAddPage} style={{ ...ghostBtn, flex: 1, display: "flex", justifyContent: "center", gap: 6 }}><Plus size={15} /> Add page</button>
          <button className="ygo-btn" onClick={onRemovePage} disabled={binder.pages.length <= 1} style={{ ...ghostBtn, flex: 1, display: "flex", justifyContent: "center", gap: 6, opacity: binder.pages.length <= 1 ? 0.4 : 1, color: C.danger }}><Trash2 size={15} /> Remove current</button>
        </div>
        <p style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.5, marginTop: 16 }}>Layout is fixed at {layout.label} for this binder. To use a different layout, create a new binder.</p>
        <Row><button className="ygo-btn" onClick={() => { name.trim() && onRename(name.trim()); onClose(); }} style={primaryBtn}>Done</button></Row>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function PrintModal({ binder, layout, onClose }) {
  const [mode, setMode] = useState("art");
  const [scope, setScope] = useState("all");
  const doPrint = () => {
    const pages = scope === "all" ? binder.pages : [binder.pages[0]];
    const W = 59, H = 86;
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups to print."); return; }
    const cell = (card) => {
      const inner = mode === "art" && card ? `<img src="${imgUrl(card.id)}" onerror="this.parentNode.classList.add('ph');this.parentNode.innerHTML='<span>'+this.alt+'</span>'" alt="${(card.name||'').replace(/"/g,'&quot;')}" />` : `<div class="lbl">${card ? card.name.replace(/</g, "&lt;") : ""}</div>`;
      return `<div class="card">${inner}</div>`;
    };
    const sheets = pages.map((p, i) => `<section class="sheet"><div class="head">${binder.name} — page ${i + 1}</div><div class="grid" style="grid-template-columns:repeat(${layout.cols},${W}mm)">${p.map(cell).join("")}</div></section>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${binder.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fff;color:#000;padding:8mm}.sheet{page-break-after:always;margin-bottom:10mm}.head{font-size:11pt;margin-bottom:4mm;color:#444}.grid{display:grid;gap:0}.card{width:${W}mm;height:${H}mm;border:.5pt dashed #555;display:flex;align-items:center;justify-content:center;overflow:hidden}.card img{width:100%;height:100%;object-fit:cover}.card.ph{padding:2mm}.card.ph span{font-size:7pt;text-align:center;word-break:break-word}.lbl{font-size:7pt;text-align:center;padding:2mm;color:#333;word-break:break-word}@media print{@page{margin:8mm}}</style></head><body>${sheets}<scr`+`ipt>window.onload=function(){setTimeout(function(){window.print()},500)}</scr`+`ipt></body></html>`);
    win.document.close();
  };
  return (
    <Overlay onClose={onClose}>
      <div style={modalBox(420)} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...modalH, marginBottom: 6 }}>Export for printing</h2>
        <p style={{ color: C.sub, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>Generates a sheet at real card size (59 × 86&nbsp;mm) with dashed cut lines. Print, cut out, and slot the placeholders into your physical binder.</p>
        <Label>What to show</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[["art", "Card art"], ["outline", "Blank + name"]].map(([v, l]) => <Toggle key={v} active={mode === v} onClick={() => setMode(v)}>{l}</Toggle>)}
        </div>
        <Label>Pages</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[["all", `All ${binder.pages.length}`], ["current", "First page only"]].map(([v, l]) => <Toggle key={v} active={scope === v} onClick={() => setScope(v)}>{l}</Toggle>)}
        </div>
        <Row>
          <button className="ygo-btn" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button className="ygo-btn" onClick={doPrint} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 7 }}><Printer size={16} /> Open print sheet</button>
        </Row>
      </div>
    </Overlay>
  );
}

/* ── Shared UI ────────────────────────────────────────────────────── */
function Overlay({ children, onClose }) {
  return <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(6,7,10,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, animation: "fade .15s ease", padding: 16 }}>{children}</div>;
}
const Toggle = ({ active, onClick, children }) => (
  <button className="ygo-btn" onClick={onClick} style={{ flex: 1, padding: "11px 0", borderRadius: 9, fontFamily: font, fontWeight: 600, fontSize: 13, background: active ? C.accent : C.panel2, color: active ? "#1a1408" : C.text, border: `1px solid ${active ? C.accent : C.border}` }}>{children}</button>
);
const Label = ({ children }) => <div style={{ fontSize: 12.5, color: C.sub, fontWeight: 600, marginBottom: 7, marginTop: 4, letterSpacing: 0.3 }}>{children}</div>;
const Center = ({ children }) => <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontSize: 14, textAlign: "center", padding: "0 20px", lineHeight: 1.5 }}>{children}</div>;
const Row = ({ children }) => <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>{children}</div>;
const modalBox = (w) => ({ width: w, maxWidth: "94vw", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 26 });
const modalH = { margin: "0 0 18px", fontSize: 20, fontWeight: 600 };
const inputStyle = { width: "100%", boxSizing: "border-box", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: font, marginBottom: 18, outline: "none" };
const primaryBtn = { background: C.accent, color: "#1a1408", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 700, fontSize: 14, fontFamily: font, cursor: "pointer" };
const ghostBtn = { background: "transparent", color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 16px", fontWeight: 600, fontSize: 14, fontFamily: font, cursor: "pointer" };
const iconBtn = { background: C.panel2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const navBtn = { background: C.panel2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const qtyBtn = { background: C.panel2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, width: 22, height: 22, fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: font };
