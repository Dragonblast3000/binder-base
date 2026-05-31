import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, X, Printer, BookOpen, Settings, ArrowLeft, Layers, Loader2, Wand2, Copy, GripVertical, Sun, Moon, Download, Upload } from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
   DATA LAYER — tries bundled /cards.json first (full offline DB),
   then live API, then a small built-in sample as last resort.
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

const SAMPLE = [
  { id: 14558127, name: "Ash Blossom & Joyous Spring", type: "Effect Monster", frameType: "effect", race: "Zombie", archetype: null, atk: 0, def: 1800, level: 3, attribute: "FIRE" },
  { id: 23434538, name: "Maxx \"C\"", type: "Effect Monster", frameType: "effect", race: "Insect", archetype: null, atk: 500, def: 200, level: 2, attribute: "EARTH" },
  { id: 38814750, name: "Dark Magician", type: "Normal Monster", frameType: "normal", race: "Spellcaster", archetype: "Dark Magician", atk: 2500, def: 2100, level: 7, attribute: "DARK" },
  { id: 89631139, name: "Blue-Eyes White Dragon", type: "Normal Monster", frameType: "normal", race: "Dragon", archetype: "Blue-Eyes", atk: 3000, def: 2500, level: 8, attribute: "LIGHT" },
  { id: 5318639, name: "Pot of Greed", type: "Spell Card", frameType: "spell", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
  { id: 44095762, name: "Mirror Force", type: "Trap Card", frameType: "trap", race: "Normal", archetype: null, atk: null, def: null, level: null, attribute: null },
];

let API_OK = true;
let CARD_DB = null;
let DB_TRIED = false;

async function ensureDB() {
  if (CARD_DB || DB_TRIED) return CARD_DB;
  DB_TRIED = true;
  try { const r = await fetch("/cards.json"); if (r.ok) CARD_DB = await r.json(); } catch {}
  return CARD_DB;
}

async function searchCards(term) {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const db = await ensureDB();
  if (db) return db.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 60);
  if (API_OK) {
    try {
      const r = await fetch(`${API}?fname=${encodeURIComponent(term)}&num=60&offset=0`);
      if (r.ok) { const d = await r.json(); return (d.data || []).slice(0, 60).map(normalize); }
      if (r.status === 400) return [];
      throw new Error("bad status");
    } catch { API_OK = false; }
  }
  return SAMPLE.filter((c) => c.name.toLowerCase().includes(q));
}

const imgUrl = (id) => `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`;

/* ════════════════════════════════════════════════════════════════════
   AUTO-ORGANISE
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
const RULES = {
  typeBucket:   { label: "Type (Monster → Spell → Trap)", cmp: (a, b) => ({ monster: 0, spell: 1, trap: 2 }[categoryOf(a)] - { monster: 0, spell: 1, trap: 2 }[categoryOf(b)]) },
  archetype:    { label: "Group same archetype",          cmp: (a, b) => (a.archetype || "~" + a.name).localeCompare(b.archetype || "~" + b.name) },
  level:        { label: "Monster level (high → low)",     cmp: (a, b) => (b.level || -1) - (a.level || -1) },
  atk:          { label: "ATK (high → low)",               cmp: (a, b) => (b.atk || -1) - (a.atk || -1) },
  def:          { label: "DEF (high → low)",               cmp: (a, b) => (b.def || -1) - (a.def || -1) },
  attribute:    { label: "Attribute (A → Z)",              cmp: (a, b) => (a.attribute || "").localeCompare(b.attribute || "") },
  spellTrapSub: { label: "Spell/Trap subtype order",       cmp: (a, b) => {
                    const ca = categoryOf(a), cb = categoryOf(b);
                    if (ca !== cb) return 0;
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

/* ── Persistence ──────────────────────────────────────────────────── */
const KEY = "ygo:binders";
const THEME_KEY = "ygo:theme";
function loadBinders() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function saveBinders(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { console.error(e); } }
function loadTheme() { try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; } }
function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch {} }

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

/* ── Themes (CSS variables) ───────────────────────────────────────── */
const THEMES = {
  dark: {
    "--bg": "#0e0f13", "--panel": "#16181f", "--panel2": "#1d2029",
    "--border": "#2a2e3a", "--accent": "#c8a04a", "--accent-fg": "#1a1408",
    "--text": "#e8e8ec", "--sub": "#8a8f9c", "--danger": "#c45a5a",
    "--overlay": "rgba(6,7,10,.72)",
  },
  light: {
    "--bg": "#f6f5f1", "--panel": "#ffffff", "--panel2": "#eeece5",
    "--border": "#d8d4c7", "--accent": "#a07a2a", "--accent-fg": "#fff8e6",
    "--text": "#1c1a14", "--sub": "#6b6555", "--danger": "#a33a28",
    "--overlay": "rgba(50,45,30,.45)",
  },
};
const font = `"Trebuchet MS","Segoe UI",system-ui,sans-serif`;
const ATTR_TINT = { DARK: "#3a2a4a", LIGHT: "#caa94a", FIRE: "#a33a28", WATER: "#2a5aa3", EARTH: "#6a5a3a", WIND: "#2a8a5a", DIVINE: "#b08a2a", spell: "#1a7a6a", trap: "#9a2a6a" };

/* ── Hook: track viewport width so we can branch layouts on mobile ── */
function useIsMobile(breakpoint = 720) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < breakpoint);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [breakpoint]);
  return m;
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function BinderApp() {
  const [binders, setBinders] = useState([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [theme, setTheme] = useState(loadTheme());
  const isMobile = useIsMobile();

  useEffect(() => { setBinders(loadBinders()); setReady(true); }, []);
  useEffect(() => { saveTheme(theme); }, [theme]);

  const persist = useCallback((next) => { setBinders(next); saveBinders(next); }, []);
  const active = binders.find((b) => b.id === activeId);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const vars = THEMES[theme];
  const rootStyle = { ...vars, background: "var(--bg)", color: "var(--text)", fontFamily: font, minHeight: "100vh", position: "relative" };

  if (!ready) return (
    <div style={{ ...rootStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 10 }} /> Loading your binders…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        body{margin:0;background:var(--bg)}
        .ygo-scroll::-webkit-scrollbar{width:8px;height:8px}
        .ygo-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px}
        .ygo-slot{transition:transform .12s,box-shadow .12s,border-color .12s}
        .ygo-slot:hover{border-color:var(--accent)!important}
        .ygo-btn{transition:all .12s;cursor:pointer}
        .ygo-btn:hover{filter:brightness(1.08)}
        .ygo-btn:active{transform:scale(.97)}
        .ygo-drag-over{outline:2px dashed var(--accent);outline-offset:-2px}
      `}</style>
      {active ? (
        <BinderView binder={active} isMobile={isMobile} theme={theme} onToggleTheme={toggleTheme}
          onBack={() => setActiveId(null)}
          onUpdate={(u) => persist(binders.map((b) => (b.id === u.id ? u : b)))} />
      ) : (
        <Library binders={binders} isMobile={isMobile} theme={theme} onToggleTheme={toggleTheme}
          onOpen={setActiveId}
          onCreate={(b) => { persist([...binders, b]); setActiveId(b.id); }}
          onDelete={(id) => persist(binders.filter((b) => b.id !== id))}
          onImport={(imported) => persist([...binders, ...imported])} />
      )}
    </div>
  );
}

/* ── Card face: tries real image, falls back to styled placeholder ── */
function CardFace({ card }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    const cat = categoryOf(card);
    const tint = cat === "monster" ? (ATTR_TINT[card.attribute] || "#444") : ATTR_TINT[cat];
    return (
      <div style={{ width: "100%", height: "100%", background: tint, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "6%", boxSizing: "border-box" }}>
        <div style={{ fontSize: "min(2.6vw,11px)", fontWeight: 700, color: "#fff", lineHeight: 1.15, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>{card.name}</div>
        <div style={{ fontSize: "min(2.2vw,9px)", color: "rgba(255,255,255,.85)", textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>
          {cat === "monster" ? `Lv${card.level ?? "-"} · ${card.atk ?? "?"}/${card.def ?? "?"}` : `${card.race || ""} ${cat}`}
        </div>
      </div>
    );
  }
  return <img src={imgUrl(card.id)} alt={card.name} loading="lazy" onError={() => setBroken(true)} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
}

/* ── Theme toggle button (reused in both screens) ─────────────────── */
function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="ygo-btn" onClick={onToggle} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={iconBtn}>
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARE / EXPORT / IMPORT — file-based "share binder"
   Export downloads the binder as a .json file; Import reads one in.
   AirDrop, email, Slack, Discord — any file transfer carries the data.
   ═══════════════════════════════════════════════════════════════════ */
const EXPORT_VERSION = 1;

function exportBinder(binder) {
  const payload = { app: "binder-base", version: EXPORT_VERSION, binder: { ...binder, id: undefined } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (binder.name || "binder").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  a.href = url; a.download = `${safe}.binder.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportAll(binders) {
  const payload = { app: "binder-base", version: EXPORT_VERSION, binders: binders.map((b) => ({ ...b, id: undefined })) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `binder-base-export.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Validate + reassign IDs to avoid collisions with existing binders.
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("That file isn't valid JSON."); }
  if (!data || data.app !== "binder-base") throw new Error("Not a Binder Base export file.");
  const list = data.binder ? [data.binder] : Array.isArray(data.binders) ? data.binders : [];
  if (!list.length) throw new Error("No binders found in the file.");
  return list.map((b) => {
    if (!b || !Array.isArray(b.pages) || typeof b.layoutId !== "string") throw new Error("Binder data is malformed.");
    return { ...b, id: uid(), name: b.name ? `${b.name} (imported)` : "Imported binder", organiseRules: b.organiseRules || [...DEFAULT_RULES] };
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
function Library({ binders, onOpen, onCreate, onDelete, onImport, isMobile, theme, onToggleTheme }) {
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseImport(text);
      onImport(imported);
      alert(`Imported ${imported.length} binder${imported.length === 1 ? "" : "s"}.`);
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "28px 32px" }}>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Layers size={isMobile ? 22 : 26} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, letterSpacing: 0.5, fontWeight: 600 }}>Binder Base</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ygo-btn" onClick={() => fileRef.current?.click()} title="Import a binder file" style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}>
            <Upload size={15} /> {!isMobile && "Import"}
          </button>
          {binders.length > 0 && (
            <button className="ygo-btn" onClick={() => exportAll(binders)} title="Export all binders to one file" style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}>
              <Download size={15} /> {!isMobile && "Export all"}
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="ygo-btn" onClick={() => setCreating(true)} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} /> {!isMobile && "New binder"}
          </button>
        </div>
      </div>
      <p style={{ color: "var(--sub)", marginTop: 4, marginBottom: 26, fontSize: 14 }}>Design your card layouts, then print cut-out placeholders for the real thing.</p>

      {binders.length === 0 ? (
        <div style={{ border: `1px dashed var(--border)`, borderRadius: 12, padding: "56px 20px", textAlign: "center", color: "var(--sub)" }}>
          <BookOpen size={40} color="var(--border)" />
          <p style={{ marginTop: 14, fontSize: 15 }}>No binders yet. Create your first one to get started.</p>
          <p style={{ marginTop: 6, fontSize: 13 }}>Or <button className="ygo-btn" onClick={() => fileRef.current?.click()} style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, font: "inherit", textDecoration: "underline" }}>import a binder file</button> from another device.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {binders.map((b) => {
            const l = LAYOUTS.find((x) => x.id === b.layoutId) || LAYOUTS[0];
            const filled = b.pages.flat().filter(Boolean).length;
            const total = b.pages.length * l.cols * l.rows;
            return (
              <div key={b.id} className="ygo-slot" onClick={() => onOpen(b.id)} style={{ background: "var(--panel)", border: `1px solid var(--border)`, borderRadius: 12, padding: 18, cursor: "pointer", animation: "fade .25s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <BookOpen size={22} color="var(--accent)" />
                  <div style={{ display: "flex", gap: 2 }}>
                    <button className="ygo-btn" onClick={(e) => { e.stopPropagation(); exportBinder(b); }} title="Export this binder" style={{ background: "transparent", border: "none", color: "var(--sub)", padding: 4 }}><Download size={16} /></button>
                    <button className="ygo-btn" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${b.name}"?`)) onDelete(b.id); }} style={{ background: "transparent", border: "none", color: "var(--sub)", padding: 4 }}><Trash2 size={16} /></button>
                  </div>
                </div>
                <h3 style={{ margin: "12px 0 4px", fontSize: 17, fontWeight: 600 }}>{b.name}</h3>
                <div style={{ color: "var(--sub)", fontSize: 13 }}>{l.label} · {b.pages.length} {b.pages.length === 1 ? "page" : "pages"}</div>
                <div style={{ marginTop: 12, height: 6, background: "var(--panel2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total ? (filled / total) * 100 : 0}%`, background: "var(--accent)" }} />
                </div>
                <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 6 }}>{filled} / {total} slots filled</div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <CreateModal isMobile={isMobile} onClose={() => setCreating(false)} onCreate={(b) => { onCreate(b); setCreating(false); }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function CreateModal({ onClose, onCreate, isMobile }) {
  const [name, setName] = useState("");
  const [layoutId, setLayoutId] = useState("3x3");
  const [pages, setPages] = useState(8);
  return (
    <Overlay onClose={onClose}>
      <div style={modalBox(420, isMobile)} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalH}>New binder</h2>
        <Label>Name</Label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="My trade binder" style={inputStyle} />
        <Label>Page layout</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
          {LAYOUTS.map((l) => <Toggle key={l.id} active={layoutId === l.id} onClick={() => setLayoutId(l.id)}>{l.label}</Toggle>)}
        </div>
        <Label>Number of pages</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <input type="range" min={1} max={40} value={pages} onChange={(e) => setPages(+e.target.value)} style={{ flex: 1, accentColor: "var(--accent)" }} />
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
function BinderView({ binder, onBack, onUpdate, isMobile, theme, onToggleTheme }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [picker, setPicker] = useState(false);
  const [tray, setTray] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showOrganise, setShowOrganise] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);   // slot index being dragged
  const [dragOver, setDragOver] = useState(null);   // slot index hovered

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

  // Swap two slots on the current page (drag-and-drop).
  const swapSlots = (from, to) => {
    if (from === to) return;
    writePage((p) => { const n = [...p]; [n[from], n[to]] = [n[to], n[from]]; return n; });
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
      {/* Header — stacks on mobile */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "16px 24px", borderBottom: `1px solid var(--border)`, background: "var(--panel)", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0, flex: isMobile ? "1 1 100%" : "0 1 auto" }}>
          <button className="ygo-btn" onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text)", display: "flex", alignItems: "center", gap: 5, fontFamily: font, fontSize: 14 }}><ArrowLeft size={18} /> {isMobile ? "" : "Library"}</button>
          <div style={{ width: 1, height: 22, background: "var(--border)" }} />
          <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{binder.name}</h2>
          <span style={{ color: "var(--sub)", fontSize: 13, flex: "0 0 auto" }}>{layout.label}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: isMobile ? "flex-end" : "flex-start", flex: isMobile ? "1 1 100%" : "0 1 auto" }}>
          <button className="ygo-btn" onClick={() => setPicker(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}><Plus size={16} /> {!isMobile && "Add cards"}</button>
          <button className="ygo-btn" onClick={() => setShowOrganise(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "9px 13px" }}><Wand2 size={16} /> {!isMobile && "Auto-organise"}</button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="ygo-btn" onClick={() => setShowSettings(true)} style={iconBtn}><Settings size={17} /></button>
          <button className="ygo-btn" onClick={() => setShowPrint(true)} style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: 7, padding: "9px 15px" }}><Printer size={16} /> {!isMobile && "Print"}</button>
        </div>
      </div>

      {armed && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "var(--panel2)", borderBottom: `1px solid var(--border)`, animation: "fade .2s ease" }}>
          <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap" }}>Placing:</span>
          <div className="ygo-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
            {tray.map((c, i) => (
              <div key={i} style={{ height: 52, width: 36, flex: "0 0 auto", borderRadius: 4, overflow: "hidden", opacity: i === 0 ? 1 : 0.45, border: i === 0 ? `2px solid var(--accent)` : "none" }} title={c.name}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12.5, color: "var(--sub)", whiteSpace: "nowrap" }}>{tray.length} left</span>
          <button className="ygo-btn" onClick={() => setTray([])} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12.5 }}>Clear</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "14px 0 4px" }}>
        <button className="ygo-btn" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => i - 1)} style={{ ...navBtn, opacity: pageIdx === 0 ? 0.3 : 1 }}><ChevronLeft size={20} /></button>
        <span style={{ fontSize: 14, color: "var(--sub)" }}>Page <b style={{ color: "var(--text)" }}>{pageIdx + 1}</b> of {binder.pages.length}</span>
        <button className="ygo-btn" disabled={pageIdx >= binder.pages.length - 1} onClick={() => setPageIdx((i) => i + 1)} style={{ ...navBtn, opacity: pageIdx >= binder.pages.length - 1 ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: isMobile ? "10px 12px 24px" : "12px 24px 30px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.cols},1fr)`,
          gap: isMobile ? 8 : 12,
          width: "100%",
          maxWidth: isMobile ? "100%" : layout.cols * 130,
        }}>
          {Array.from({ length: perPage }).map((_, slot) => {
            const card = page[slot];
            const isDragOver = dragOver === slot && dragFrom !== null && dragFrom !== slot;
            return (
              <div
                key={slot}
                className={"ygo-slot" + (isDragOver ? " ygo-drag-over" : "")}
                draggable={!!card && !armed}
                onDragStart={(e) => { setDragFrom(slot); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                onDragOver={(e) => { if (dragFrom !== null && dragFrom !== slot) { e.preventDefault(); setDragOver(slot); } }}
                onDragLeave={() => { if (dragOver === slot) setDragOver(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== slot) swapSlots(dragFrom, slot); setDragFrom(null); setDragOver(null); }}
                onClick={() => { if (armed) placeFromTray(slot); else if (!card) setPicker(true); }}
                style={{
                  position: "relative", aspectRatio: "59/86", borderRadius: 9,
                  cursor: card ? (armed ? "pointer" : "grab") : "pointer",
                  overflow: "hidden",
                  background: card ? "transparent" : "var(--panel2)",
                  border: `1.5px ${card ? "solid" : "dashed"} ${card ? "var(--accent)" : armed ? "var(--accent)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {card ? (
                  <>
                    <CardFace card={card} />
                    <button className="ygo-btn" onClick={(e) => { e.stopPropagation(); setCard(slot, null); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.65)", border: "none", color: "#fff", borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
                  </>
                ) : (
                  <Plus size={22} color={armed ? "var(--accent)" : "var(--border)"} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isMobile && (
        <div style={{ textAlign: "center", color: "var(--sub)", fontSize: 12, paddingBottom: 16 }}>
          Drag cards to reorder · click empty slot to add
        </div>
      )}

      {picker && <CardPicker isMobile={isMobile} onClose={() => setPicker(false)} onAdd={(cards) => { setTray((t) => [...t, ...cards]); setPicker(false); }} />}
      {showSettings && <SettingsModal isMobile={isMobile} binder={binder} layout={layout} onClose={() => setShowSettings(false)} onAddPage={addPage} onRemovePage={removePage} onRename={(n) => onUpdate({ ...binder, name: n })} onExport={() => exportBinder(binder)} />}
      {showPrint && <PrintModal isMobile={isMobile} binder={binder} layout={layout} onClose={() => setShowPrint(false)} />}
      {showOrganise && <OrganiseModal isMobile={isMobile} initialRules={rules} count={binder.pages.flat().filter(Boolean).length + tray.length} onClose={() => setShowOrganise(false)} onRun={runOrganise} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function CardPicker({ onClose, onAdd, isMobile }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [basket, setBasket] = useState([]);
  const timer = useRef(null);

  const run = useCallback(async (term) => {
    if (!term.trim()) { setResults([]); setEmpty(false); return; }
    setLoading(true);
    const cards = await searchCards(term);
    setResults(cards); setEmpty(cards.length === 0); setLoading(false);
  }, []);
  useEffect(() => { clearTimeout(timer.current); timer.current = setTimeout(() => run(q), 350); return () => clearTimeout(timer.current); }, [q, run]);

  const addToBasket = (card) => setBasket((b) => {
    const ex = b.find((x) => x.card.id === card.id);
    if (ex) return b.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x));
    return [...b, { card, qty: 1 }];
  });
  const setQty = (card, qty) => setBasket((b) => qty <= 0 ? b.filter((x) => x.card !== card) : b.map((x) => (x.card === card ? { ...x, qty } : x)));
  const total = basket.reduce((n, x) => n + x.qty, 0);
  const confirm = () => { const out = []; basket.forEach(({ card, qty }) => { for (let i = 0; i < qty; i++) out.push(card); }); onAdd(out); };

  // On mobile, basket sits below results (stacked); on desktop, side-by-side.
  return (
    <Overlay onClose={onClose}>
      <div style={{
        width: isMobile ? "100%" : 620, maxWidth: "100vw",
        height: isMobile ? "100vh" : 600, maxHeight: isMobile ? "100vh" : "88vh",
        background: "var(--panel)", border: isMobile ? "none" : `1px solid var(--border)`,
        borderRadius: isMobile ? 0 : 14, display: "flex", flexDirection: "column", overflow: "hidden"
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid var(--border)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add cards</h2>
            <button className="ygo-btn" onClick={onClose} style={iconBtn}><X size={17} /></button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={16} color="var(--sub)" style={{ position: "absolute", left: 12, top: 11 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by card name…" style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>
          <div className="ygo-scroll" style={{ flex: 1, overflowY: "auto", padding: 14, borderRight: isMobile ? "none" : `1px solid var(--border)`, borderBottom: isMobile ? `1px solid var(--border)` : "none", minHeight: isMobile ? "40vh" : "auto" }}>
            {loading && <Center><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></Center>}
            {!loading && empty && <Center>No matches.</Center>}
            {!loading && !q && <Center>Start typing to search.</Center>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(82px,1fr))", gap: 10 }}>
              {results.map((c) => (
                <div key={c.id} className="ygo-slot" onClick={() => addToBasket(c)} title={c.name}
                  style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: `1px solid var(--border)`, background: "var(--panel2)", aspectRatio: "59/86", animation: "fade .2s ease" }}>
                  <CardFace card={c} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ width: isMobile ? "100%" : 230, display: "flex", flexDirection: "column", maxHeight: isMobile ? "45vh" : "auto" }}>
            <div style={{ padding: "10px 14px 8px", fontSize: 13, color: "var(--sub)", fontWeight: 700, borderBottom: `1px solid var(--border)` }}>Selected · {total} {total === 1 ? "copy" : "copies"}</div>
            <div className="ygo-scroll" style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {!basket.length && <div style={{ color: "var(--sub)", fontSize: 13, textAlign: "center", padding: "20px 8px", lineHeight: 1.5 }}>Tap cards to add. Use −/+ for copies.</div>}
              {basket.map(({ card, qty }) => (
                <div key={card.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: `1px solid var(--border)` }}>
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
            <div style={{ padding: 10, borderTop: `1px solid var(--border)` }}>
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

/* ═══════════════════════════════════════════════════════════════════ */
function OrganiseModal({ initialRules, count, onClose, onRun, isMobile }) {
  const [active, setActive] = useState(initialRules.filter((id) => RULES[id]));
  const inactive = Object.keys(RULES).filter((id) => !active.includes(id));
  const [drag, setDrag] = useState(null);

  const move = (from, to) => setActive((a) => { const n = [...a]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  const enable = (id) => setActive((a) => [...a, id]);
  const disable = (id) => setActive((a) => a.filter((x) => x !== id));

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...modalBox(460, isMobile), maxHeight: isMobile ? "100vh" : "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Wand2 size={22} color="var(--accent)" /><h2 style={{ ...modalH, margin: 0 }}>Auto-organise</h2>
        </div>
        <p style={{ color: "var(--sub)", fontSize: 13, lineHeight: 1.55, margin: "0 0 16px" }}>
          Sorting all <b style={{ color: "var(--text)" }}>{count}</b> cards. Drag to set priority. Toggle any rule off to ignore it.
        </p>
        <div className="ygo-scroll" style={{ overflowY: "auto", flex: 1, marginBottom: 4 }}>
          <Label>Active rules (in order)</Label>
          <div style={{ marginBottom: 14 }}>
            {active.map((id, idx) => (
              <div key={id} draggable
                onDragStart={() => setDrag(idx)}
                onDragOver={(e) => { e.preventDefault(); if (drag !== null && drag !== idx) { move(drag, idx); setDrag(idx); } }}
                onDragEnd={() => setDrag(null)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, background: "var(--panel2)", border: `1px solid ${drag === idx ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, cursor: "grab" }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: "var(--accent)", color: "var(--accent-fg)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{idx + 1}</span>
                <GripVertical size={15} color="var(--sub)" />
                <span style={{ flex: 1, fontSize: 13.5 }}>{RULES[id].label}</span>
                <button className="ygo-btn" onClick={() => disable(id)} style={{ background: "transparent", border: "none", color: "var(--sub)", padding: 2 }}><X size={15} /></button>
              </div>
            ))}
            {!active.length && <div style={{ color: "var(--sub)", fontSize: 13, padding: "10px 0" }}>No rules — cards keep current order.</div>}
          </div>
          {inactive.length > 0 && <>
            <Label>Add a rule</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {inactive.map((id) => (
                <button key={id} className="ygo-btn" onClick={() => enable(id)}
                  style={{ background: "transparent", color: "var(--text)", border: `1px dashed var(--border)`, borderRadius: 7, padding: "7px 10px", fontSize: 12.5, fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
                  <Plus size={13} /> {RULES[id].label}
                </button>
              ))}
            </div>
          </>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
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
function SettingsModal({ binder, layout, onClose, onAddPage, onRemovePage, onRename, onExport, isMobile }) {
  const [name, setName] = useState(binder.name);
  return (
    <Overlay onClose={onClose}>
      <div style={modalBox(400, isMobile)} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalH}>Binder settings</h2>
        <Label>Name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && onRename(name.trim())} style={inputStyle} />
        <Label>Pages — currently {binder.pages.length}</Label>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button className="ygo-btn" onClick={onAddPage} style={{ ...ghostBtn, flex: 1, display: "flex", justifyContent: "center", gap: 6 }}><Plus size={15} /> Add page</button>
          <button className="ygo-btn" onClick={onRemovePage} disabled={binder.pages.length <= 1} style={{ ...ghostBtn, flex: 1, display: "flex", justifyContent: "center", gap: 6, opacity: binder.pages.length <= 1 ? 0.4 : 1, color: "var(--danger)" }}><Trash2 size={15} /> Remove current</button>
        </div>
        <Label>Share</Label>
        <button className="ygo-btn" onClick={onExport} style={{ ...ghostBtn, width: "100%", display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
          <Download size={15} /> Export this binder to a file
        </button>
        <p style={{ color: "var(--sub)", fontSize: 12, lineHeight: 1.5, margin: "0 0 14px" }}>Send the file via AirDrop, email, etc., then use Import on the other device.</p>
        <p style={{ color: "var(--sub)", fontSize: 12.5, lineHeight: 1.5 }}>Layout is fixed at {layout.label} for this binder. To change layout, make a new binder.</p>
        <Row><button className="ygo-btn" onClick={() => { name.trim() && onRename(name.trim()); onClose(); }} style={primaryBtn}>Done</button></Row>
      </div>
    </Overlay>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
function PrintModal({ binder, layout, onClose, isMobile }) {
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
      <div style={modalBox(420, isMobile)} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...modalH, marginBottom: 6 }}>Export for printing</h2>
        <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>Generates a sheet at real card size (59 × 86&nbsp;mm) with dashed cut lines.</p>
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
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, animation: "fade .15s ease", padding: 0 }}>{children}</div>;
}
const Toggle = ({ active, onClick, children }) => (
  <button className="ygo-btn" onClick={onClick} style={{ flex: 1, padding: "11px 0", borderRadius: 9, fontFamily: font, fontWeight: 600, fontSize: 13, background: active ? "var(--accent)" : "var(--panel2)", color: active ? "var(--accent-fg)" : "var(--text)", border: `1px solid ${active ? "var(--accent)" : "var(--border)"}` }}>{children}</button>
);
const Label = ({ children }) => <div style={{ fontSize: 12.5, color: "var(--sub)", fontWeight: 600, marginBottom: 7, marginTop: 4, letterSpacing: 0.3 }}>{children}</div>;
const Center = ({ children }) => <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sub)", fontSize: 14, textAlign: "center", padding: "0 20px", lineHeight: 1.5 }}>{children}</div>;
const Row = ({ children }) => <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>{children}</div>;
const modalBox = (w, isMobile) => isMobile
  ? { width: "100%", maxWidth: "100vw", height: "100vh", maxHeight: "100vh", background: "var(--panel)", borderRadius: 0, padding: 22, overflow: "auto" }
  : { width: w, maxWidth: "94vw", background: "var(--panel)", border: `1px solid var(--border)`, borderRadius: 14, padding: 26 };
const modalH = { margin: "0 0 18px", fontSize: 20, fontWeight: 600 };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "var(--panel2)", border: `1px solid var(--border)`, borderRadius: 9, padding: "10px 12px", color: "var(--text)", fontSize: 14, fontFamily: font, marginBottom: 18, outline: "none" };
const primaryBtn = { background: "var(--accent)", color: "var(--accent-fg)", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 700, fontSize: 14, fontFamily: font, cursor: "pointer" };
const ghostBtn = { background: "transparent", color: "var(--text)", border: `1px solid var(--border)`, borderRadius: 9, padding: "10px 16px", fontWeight: 600, fontSize: 14, fontFamily: font, cursor: "pointer" };
const iconBtn = { background: "var(--panel2)", color: "var(--text)", border: `1px solid var(--border)`, borderRadius: 9, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const navBtn = { background: "var(--panel2)", color: "var(--text)", border: `1px solid var(--border)`, borderRadius: 9, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const qtyBtn = { background: "var(--panel2)", color: "var(--text)", border: `1px solid var(--border)`, borderRadius: 6, width: 22, height: 22, fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: font };
