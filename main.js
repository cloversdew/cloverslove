import { sfx } from "./sfx.js";
import { createAsyncCache } from "./lib/async-cache.js";

const DISCORD_ID = "262467539685212160";
const SECTIONS = ["about", "repos", "socials", "settings"];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = () => settings.calm || motionPreference.matches;
let runtimeReady = false;
async function request(url, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });

    const text = await response.text();
    return { ok: response.ok, status: response.status, text, json: () => JSON.parse(text) };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const settings = Object.assign({ sfx: true, video: true, calm: false }, store.get("settings", {}));
delete settings.sound;
settings.music = (() => { try { return sessionStorage.getItem("musicOff") !== "1"; } catch { return true; } })();
const saveSettings = () => {
  const { music, ...rest } = settings;
  store.set("settings", rest);
  try { music ? sessionStorage.removeItem("musicOff") : sessionStorage.setItem("musicOff", "1"); } catch {}
};
sfx.enabled = settings.sfx;

const INTERACTIVE = "button, a, .opt, input[type=search]";
let hovered = null;
addEventListener("pointerdown", () => sfx.unlock(), { capture: true });
addEventListener("keydown", () => sfx.unlock(), { capture: true });
document.addEventListener("pointerover", (e) => {
  const el = e.target.closest(INTERACTIVE);
  if (el === hovered) return;
  hovered = el;

  if (el && !el.closest("#menu")) sfx.play("hover");
});
document.addEventListener("click", (e) => {
  const el = e.target.closest(INTERACTIVE);

  if (!el || el.closest("[data-nav]") || el.matches("input[type=search]")) return;
  sfx.play(el.matches(".opt, [role=tab]") ? "toggle" : "select");
});

let entered = false;
function enterSite(e) {
  if (entered) return;
  entered = true;
  const splash = $("#splash");
  splash.classList.add("opening");
  sfx.unlock();
  sfx.play("open");
  if (settings.music) startMusic();
  $("#home").classList.add("entering");
  document.body.classList.remove("is-locked");
  syncRuntime();

  setTimeout(() => splash.classList.add("gone"), reducedMotion() ? 0 : 1400);
  setTimeout(() => $("#home").classList.remove("entering"), 2200);
  setTimeout(() => (current ? $("#back") : menuBtns[sel])?.focus({ preventScroll: true }), reducedMotion() ? 0 : 900);
}
$("#splash").addEventListener("click", enterSite);
$("#splash").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterSite(); }
});
$("#splash").focus({ preventScroll: true });

const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true });
function tick(countdown = false) {
  const time = fmt.format(new Date()).toLowerCase();
  if ($("#clock").textContent !== time) $("#clock").textContent = time;
  if (!countdown) return;
  const now = new Date();
  let next = new Date(now.getFullYear(), 5, 12);
  if (next <= now) next = new Date(now.getFullYear() + 1, 5, 12);
  let s = Math.floor((next - now) / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  $("#bdayCount").textContent = `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}
tick();

const body = document.body;
const menuBtns = $$("#menu button");
const column = $("#column");
const brand = $("#brand");
let sel = 0;
let current = null;
let busy = false;

menuBtns.forEach((b, i) => b.style.setProperty("--n", i));
$(".home-hint").style.setProperty("--n", menuBtns.length);

function camera(x, y, z) {
  const r = document.documentElement.style;
  r.setProperty("--cx", `${x}%`);
  r.setProperty("--cy", `${y}%`);
  r.setProperty("--cz", z);
}

const CHAR_X = 0.42;
const BLEED = 1.14;

function frameCharacter(targetX, zMin, zMax = 1.2) {
  const W = innerWidth, H = innerHeight;
  const sw = W * BLEED, sh = H * BLEED;
  const s = Math.max(sw / 1920, sh / 1080);
  const dispW = 1920 * s;
  const fromCenter = (sw - dispW) / 2 + CHAR_X * dispW - sw / 2;
  let z = zMin, tx = 0;
  for (; z <= zMax; z += 0.02) {
    tx = targetX - W / 2 - fromCenter * z;
    if (Math.abs(tx) <= (sw * z) / 2 - W / 2) break;
  }
  z = Math.min(z, zMax);
  const limit = (sw * z) / 2 - W / 2;
  tx = Math.max(-limit, Math.min(limit, tx));
  return [(tx / sw) * 100, z];
}
const homeCamera = () => {
  if (innerWidth <= 820) return camera(0, sel * 0.5, 1.02);

  const right = Math.max($("#menu").getBoundingClientRect().right, $("#brand").getBoundingClientRect().right);
  const [x, z] = frameCharacter(right + innerWidth * 0.06 + sel * 6, 1.08);
  camera(x, -1 + sel * 0.5, z);
};
const sectionCamera = (i) => {
  if (innerWidth <= 820) return camera(0, -2, 1.08);
  const [x, z] = frameCharacter(innerWidth * 0.24 + i * 6, 1.06);
  camera(x, -1, z);
};
addEventListener("resize", () => (current ? sectionCamera(SECTIONS.indexOf(current)) : homeCamera()));

function select(i, quiet = false) {
  const next = (i + menuBtns.length) % menuBtns.length;
  if (next !== sel && !quiet && !current) sfx.play("hover");
  sel = next;
  menuBtns.forEach((b, j) => b.classList.toggle("sel", j === sel));
  if (!current) homeCamera();
}
select(0);

menuBtns.forEach((b, i) => {
  b.addEventListener("mouseenter", () => !current && select(i));
  b.addEventListener("focus", () => !current && select(i));
  b.addEventListener("click", () => go(b.dataset.go));
});

let wheelAcc = 0, wheelLock = 0;
addEventListener("wheel", (e) => {
  if (current || !entered) return;
  wheelAcc += e.deltaY;
  const now = performance.now();
  if (Math.abs(wheelAcc) < 30 || now < wheelLock) return;
  select(sel + Math.sign(wheelAcc));
  wheelAcc = 0;
  wheelLock = now + 160;
}, { passive: true });

addEventListener("keydown", (e) => {
  if (e.defaultPrevented) return;
  if (!entered) return;
  const typing = e.target.matches("input[type=search]");
  if (!current) {
    if (["ArrowDown", "s", "S"].includes(e.key)) { e.preventDefault(); select(sel + 1); }
    else if (["ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); select(sel - 1); }
    else if (["Enter", " ", "ArrowRight", "d", "D"].includes(e.key) && !e.target.matches("button")) { e.preventDefault(); go(menuBtns[sel].dataset.go); }
  } else if (e.key === "Escape" || (e.key === "ArrowLeft" && !typing) || (e.key === "Backspace" && !typing)) {
    e.preventDefault();
    go(null);
  }
});

function renderSection(name) {
  const sec = $(`[data-section="${name}"]`);
  $$("[data-section]").forEach((s) => (s.hidden = s !== sec));
  $("#columnTitle").textContent = sec.dataset.title;
  const subs = $$("[data-sub]", sec);
  const tabs = $("#subtabs");
  tabs.innerHTML = "";
  subs.forEach((sub, i) => {
    const t = document.createElement("button");
    t.role = "tab";
    t.id = `tab-${name}-${i}`;
    sub.id = `panel-${name}-${i}`;
    sub.setAttribute("role", "tabpanel");
    sub.setAttribute("aria-labelledby", t.id);
    t.setAttribute("aria-controls", sub.id);
    t.textContent = sub.dataset.sub;
    t.setAttribute("aria-selected", i === 0);
    t.addEventListener("click", () => showSub(sec, i));
    t.addEventListener("keydown", (e) => {
      const next = e.key === "ArrowRight" ? (i + 1) % subs.length : e.key === "ArrowLeft" ? (i - 1 + subs.length) % subs.length : e.key === "Home" ? 0 : e.key === "End" ? subs.length - 1 : null;
      if (next === null) return;
      e.preventDefault();
      showSub(sec, next);
      tabs.children[next].focus();
    });
    tabs.append(t);
  });
  showSub(sec, 0);
}
function showSub(sec, i) {
  $$("[data-sub]", sec).forEach((s, j) => (s.hidden = j !== i));
  $$("#subtabs button").forEach((t, j) => {
    t.setAttribute("aria-selected", j === i);
    t.tabIndex = j === i ? 0 : -1;
  });
  $("#pane").scrollTop = 0;
  if (runtimeReady && current === sec.dataset.section) syncRuntime();
}

const reveals = [$("#columnSlot"), $(".column-head"), $("#subtabs"), $("#pane")];
reveals.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--n", i); });

async function go(name, { push = true } = {}) {
  if (busy || name === current) return;
  busy = true;
  if (push) history.pushState(null, "", name ? `#${name}` : location.pathname);
  sfx.play(!name ? "back" : current ? "select" : "open");

  if (name && current) {

    column.classList.add("out");
    await wait(reducedMotion() ? 0 : 220);
    renderSection(name);
    column.classList.remove("out");
    sectionCamera(SECTIONS.indexOf(name));
  } else if (name) {

    select(SECTIONS.indexOf(name), true);
    renderSection(name);
    column.classList.remove("out", "in");
    const a = brand.getBoundingClientRect();
    body.classList.replace("is-home", "is-section");
    flipBrandFrom(a, $("#columnSlot"));
    sectionCamera(SECTIONS.indexOf(name));
    void column.offsetWidth;
    column.classList.add("in");
    column.inert = !entered;
    if (entered) $("#back").focus({ preventScroll: true });
  } else {

    column.classList.add("out");
    column.classList.remove("in");
    await wait(reducedMotion() ? 0 : 200);
    const a = brand.getBoundingClientRect();
    body.classList.replace("is-section", "is-home");
    flipBrandFrom(a, $("#homeSlot"));
    homeCamera();
    $("#home").inert = !entered;
    if (entered) menuBtns[sel].focus({ preventScroll: true });
  }
  current = name;
  syncRuntime();
  await wait(reducedMotion() ? 0 : 450);
  busy = false;
}
function flipBrandFrom(a, target) {
  target.append(brand);
  const b = brand.getBoundingClientRect();
  if (!a.width || !b.width || reducedMotion()) return;

  const toRight = getComputedStyle(target).justifyContent === "flex-end";
  brand.style.transformOrigin = toRight ? "top right" : "top left";
  const dx = toRight ? a.right - b.right : a.left - b.left;
  brand.animate(
    [{ transform: `translate(${dx}px, ${a.top - b.top}px) scale(${a.width / b.width})` }, { transform: "none" }],
    { duration: 900, easing: "cubic-bezier(.7,0,.2,1)" }
  );
}

$("#back").addEventListener("click", () => go(null));
brand.addEventListener("click", (e) => { e.preventDefault(); go(null); });
$$('a[href^="#"]').forEach((a) => {
  const h = a.getAttribute("href").slice(1);
  if (SECTIONS.includes(h)) { a.dataset.nav = ""; a.addEventListener("click", (e) => { e.preventDefault(); go(h); }); }
});
addEventListener("popstate", () => {
  const h = location.hash.slice(1);
  go(SECTIONS.includes(h) ? h : null, { push: false });
});

let contributionsPromise;
function loadContributions() {
  if (contributionsPromise) return contributionsPromise;
  contributionsPromise = renderContributions();
  return contributionsPromise;
}
async function renderContributions() {
  const grid = $("#ghGrid");
  try {
    const response = await request("https://github-contributions-api.jogruber.de/v4/cloversdew?y=last");
    if (!response.ok) throw new Error(response.status);
    const j = response.json();
    if (!Array.isArray(j.contributions) || !j.contributions.length) throw new Error("No contributions");
    const days = j.contributions;
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    const lead = new Date(days[0].date + "T00:00").getDay();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<i class="pad"></i>');
    for (const d of days) {
      const label = `${d.count} contribution${d.count === 1 ? "" : "s"} on ${d.date}`;
      cells.push(`<i data-l="${d.level}" title="${label}"></i>`);
    }
    grid.innerHTML = cells.join("");
    const weeks = Math.ceil(cells.length / 7);
    $("#ghMonths").style.setProperty("--weeks", weeks);
    grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;

    const labels = Array(weeks).fill("");
    let lastMonth = -1;
    days.forEach((d, i) => {
      const m = new Date(d.date + "T00:00").getMonth();
      const w = Math.floor((i + lead) / 7);
      if (m !== lastMonth && w < weeks - 1) { labels[w] = MONTHS[m]; lastMonth = m; }
    });

    let prev = -9;
    $("#ghMonths").innerHTML = labels.map((t, w) => {
      if (!t || w - prev < 3) return "<span></span>";
      prev = w;
      return `<span>${t}</span>`;
    }).join("");
    $("#ghTotal").textContent = `${j.total.lastYear} this year`;
  } catch {

    grid.style.display = "block";
    grid.innerHTML = '<img src="https://ghchart.rshah.org/4fc3f7/cloversdew" alt="" style="width:100%;filter:invert(1) hue-rotate(180deg);mix-blend-mode:screen" />';
  }
}

const STATUS = { online: ["#3ba55d", "online"], idle: ["#faa81a", "idle"], dnd: ["#ed4245", "do not disturb"], offline: ["#747f8d", "offline"] };
let spotify = null;

const playFrom = (sp) => Number.isFinite(sp.timestamps?.start) && sp.timestamps.start > 0 ? ({
  id: sp.track_id, song: sp.song, artist: sp.artist, album: sp.album, art: sp.album_art_url,
  start: sp.timestamps.start, end: sp.timestamps?.end ?? null,
}) : null;

function applyPresence(d) {
  const u = d.discord_user;
  if (u?.avatar) {
    const avatar = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=128`;
    if ($("#dAvatar").src !== avatar) $("#dAvatar").src = avatar;
  }
  const [color, label] = STATUS[d.discord_status] || STATUS.offline;
  $("#dDot").style.background = color;
  $("#dDot").style.color = color;
  $("#dStatus").textContent = `${label} on discord`;

  const acts = d.activities || [];
  const custom = acts.find((a) => a.type === 4);
  const act = acts.find((a) => a.type !== 4 && a.name !== "Spotify");
  $("#msg").textContent = custom?.state || "";
  $("#actTitle").textContent = act ? act.name : "not doing anything";
  $("#actSub").textContent = act ? [act.details, act.state].filter(Boolean).join(" · ") || "in progress" : "discord is quiet.";

  const next = d.listening_to_spotify ? d.spotify : null;

  if (spotify && (!next || next.track_id !== spotify.track_id || next.timestamps?.start !== spotify.timestamps?.start)) {
    notePlay(playFrom(spotify));
  }
  spotify = next;
  renderMusic();
  renderHistory();
}

async function presence() {
  if (!presenceActive || presenceController) return;
  const controller = new AbortController();
  presenceController = controller;
  try {
    const response = await request(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`, { signal: controller.signal });
    if (!response.ok) return;
    const j = response.json();
    if (presenceActive && !controller.signal.aborted && !liveReady && j.success) applyPresence(j.data);
  } catch {

  } finally {
    if (presenceController === controller) presenceController = null;
  }
}

let liveSocket = null;
let liveReady = false;
let presenceActive = false;
let presenceGeneration = 0;
let presenceController = null;
let reconnectTimer, heartbeatTimer, presenceTimer;
function connectLive(retry = 1000) {
  if (!presenceActive) return;
  let ws;
  try { ws = new WebSocket("wss://api.lanyard.rest/socket"); } catch { return; }
  liveSocket = ws;
  ws.onmessage = (e) => {
    if (!presenceActive || liveSocket !== ws) return;
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.op === 1) {

      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })), m.d.heartbeat_interval);
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
    } else if (m.op === 0 && (m.t === "INIT_STATE" || m.t === "PRESENCE_UPDATE")) {
      liveReady = true;
      retry = 1000;
      applyPresence(m.d);
    }
  };
  ws.onclose = () => {
    if (liveSocket !== ws) return;
    clearInterval(heartbeatTimer);
    liveSocket = null;
    liveReady = false;
    if (presenceActive) reconnectTimer = setTimeout(() => connectLive(Math.min(retry * 2, 30000)), retry);
  };
}
function syncPresence(active) {
  if (active === presenceActive) return;
  presenceActive = active;
  const generation = ++presenceGeneration;
  clearTimeout(reconnectTimer);
  clearTimeout(presenceTimer);
  clearInterval(heartbeatTimer);
  if (!active) {
    presenceController?.abort();
    const socket = liveSocket;
    liveSocket = null;
    liveReady = false;
    socket?.close();
    return;
  }
  connectLive();
  const poll = async () => {
    if (!presenceActive || generation !== presenceGeneration) return;
    if (!liveReady) await presence();
    if (presenceActive && generation === presenceGeneration) presenceTimer = setTimeout(poll, 15000);
  };

  presenceTimer = setTimeout(poll, 1500);
}

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", CSS: "#a978e6", HTML: "#e34c26", "C++": "#f34b7d",
  C: "#8d9bb0", Python: "#3572a5", Rust: "#dea584", Go: "#00add8", Lua: "#5b6cf0", Java: "#b07219", Shell: "#89e051",
};
let repos = null;
let reposAt = 0;
const repoCache = createAsyncCache({ ttl: 600000 });

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

async function loadRepos() {
  if (reposAt && Date.now() - reposAt >= 600000) {
    repoCache.invalidate("repos");
    reposAt = 0;
  }
  try {
    const snapshot = await repoCache.get("repos", async () => {

      let data = null;
      let at = Date.now();
      try {
        const cached = JSON.parse(sessionStorage.getItem("repos2") || "null");
        if (cached && Array.isArray(cached.data) && Date.now() - cached.t < 600000) {
          data = cached.data;
          at = cached.t;
        }
      } catch {}
      if (!data) {
        const r = await request("https://api.github.com/users/cloversdew/repos?sort=pushed&per_page=100");
        if (!r.ok) throw new Error(r.status);
        data = r.json()
          .filter((x) => !x.fork)
          .map((x) => ({
            name: x.name, desc: x.description, lang: x.language, stars: x.stargazers_count,
            pushed: x.pushed_at, created: x.created_at, url: x.html_url, site: x.homepage,
            branch: x.default_branch, topics: x.topics || [],
          }));
        at = Date.now();
        try { sessionStorage.setItem("repos2", JSON.stringify({ t: at, data })); } catch {}
      }
      return { data, at };
    });
    const { data, at } = snapshot;
    reposAt = at;
    if (repos !== data) {
      repos = data;
      $("#repoCount").textContent = repos.length;
      drawRepos();
      renderLastWorked();
    }
  } catch {

    if (!repos) $("#repoList").innerHTML = '<p class="empty">couldn\'t reach github right now. <a class="u" href="https://github.com/cloversdew" target="_blank" rel="noopener">see them there</a></p>';
  }
}

const SKIP_SECTION = /^(setup|install|installation|run|run locally|running|local development|development|dev|usage|build|building|requirements|prerequisites|getting started|quick ?start|license|contributing|scripts|deploy|deployment|configuration|config|env|environment|commands|controls|troubleshooting|music|credits|assets|notes|todo|changelog|files|project structure|structure|faq)\b/i;

const trim = (s, n = 300) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,.;:]$/, "") + "…");
function summarize(md) {
  const clean = (s) => s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  md = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const paras = [], bullets = [];
  let section = "", buf = [];
  const flush = () => { if (buf.length) { paras.push(buf.join(" ")); buf = []; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) { flush(); section = clean(h[1]); continue; }
    if (SKIP_SECTION.test(section)) continue;
    if (!line) { flush(); continue; }
    if (/^\|/.test(line) || /^---+$/.test(line)) continue;
    const li = line.match(/^(?:[-*+]|\d+\.)\s+(.*)/);
    if (li) { flush(); bullets.push(li[1]); continue; }
    buf.push(line);
  }
  flush();
  return {
    paras: paras.map(clean).filter((p) => p.length > 3).slice(0, 2).map((p) => trim(p)),
    bullets: bullets.map(clean).filter(Boolean).slice(0, 5),
  };
}

const readmes = createAsyncCache({ ttl: 600000 });
function readme(r) {
  return readmes.get(`${r.name}/${r.branch || "main"}`, async () => {
    for (const f of ["README.md", "readme.md", "Readme.md"]) {
      const res = await request(`https://raw.githubusercontent.com/cloversdew/${r.name}/${r.branch || "main"}/${f}`);
      if (res.ok) return res.text;
      if (res.status !== 404) throw new Error(res.status);
    }
    return null;
  });
}

const monthYear = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toLowerCase();

function repoRow(r) {
  const row = document.createElement("div");
  row.className = "repo";
  row.innerHTML = `
    <button class="repo-main" aria-expanded="false">
      <b><span class="repo-name"></span><i class="repo-toggle" aria-hidden="true">+</i></b>
      <span class="repo-desc"></span>
      <span class="repo-meta"></span>
    </button>
    <div class="repo-more"><div class="repo-more-inner"></div></div>`;
  $(".repo-name", row).textContent = r.name;
  $(".repo-desc", row).textContent = r.desc || "no description";
  const meta = [];
  if (r.lang) meta.push(`<span><i class="dot" style="background:${LANG_COLORS[r.lang] || "#9aa"}"></i>${r.lang}</span>`);
  if (r.stars) meta.push(`<span>★ ${r.stars}</span>`);
  meta.push(`<span>${ago(r.pushed)}</span>`);
  $(".repo-meta", row).innerHTML = meta.join("");
  $(".repo-main", row).addEventListener("click", () => toggleRepo(row, r));
  return row;
}

async function toggleRepo(row, r) {
  const btn = $(".repo-main", row);
  const open = btn.getAttribute("aria-expanded") !== "true";

  $$(".repo.open").forEach((o) => { if (o !== row) { o.classList.remove("open"); $(".repo-main", o).setAttribute("aria-expanded", "false"); } });
  row.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", open);
  if (!open || row.dataset.filled) return;
  row.dataset.filled = "1";

  const inner = $(".repo-more-inner", row);
  inner.innerHTML = '<p class="repo-loading">reading the readme…</p>';
  let md;
  try {
    md = await readme(r);
  } catch {
    delete row.dataset.filled;
    inner.innerHTML = '<p class="repo-loading">couldn\'t load the readme. close and reopen to retry.</p>';
    return;
  }
  const { paras, bullets } = md ? summarize(md) : { paras: [], bullets: [] };

  inner.innerHTML = "";
  const about = document.createElement("div");
  about.className = "repo-about";
  if (!paras.length && !bullets.length) {
    const p = document.createElement("p");
    p.textContent = r.desc ? r.desc : "no readme yet, so the code will have to speak for itself.";
    about.append(p);
  }
  paras.forEach((t) => { const p = document.createElement("p"); p.textContent = t; about.append(p); });
  if (bullets.length) {
    const ul = document.createElement("ul");
    bullets.forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.append(li); });
    about.append(ul);
  }
  inner.append(about);

  const facts = document.createElement("dl");
  facts.className = "repo-facts";
  const add = (k, v) => { if (!v) return; const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd></dd>"; d.firstChild.textContent = k; d.lastChild.textContent = v; facts.append(d); };
  add("started", monthYear(r.created));
  add("updated", ago(r.pushed));
  add("language", r.lang);
  if (r.topics.length) add("topics", r.topics.join(", "));
  inner.append(facts);

  const actions = document.createElement("div");
  actions.className = "repo-actions";
  const link = (href, text) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = text; actions.append(a); };
  link(r.url, "view on github ↗");
  if (r.site) link(r.site, "visit site ↗");
  inner.append(actions);
}

function drawRepos() {
  if (!repos) return;
  const q = $("#repoSearch").value.trim().toLowerCase();
  const items = repos.filter((r) => !q || [r.name, r.desc, r.lang].join(" ").toLowerCase().includes(q));
  $("#repoList").replaceChildren(...items.map(repoRow));
  if (!items.length) $("#repoList").innerHTML = '<p class="empty">nothing matches that search.</p>';
}
$("#repoSearch").addEventListener("input", drawRepos);

let lastRepo = null;
function sinceText(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}
function tickSince() {
  if (!lastRepo) return;
  const t = sinceText(Date.now() - new Date(lastRepo.pushed));
  $$("[data-since]").forEach((el) => (el.textContent = t));
}

function renderLastWorked() {
  if (!repos || !repos.length) return;
  lastRepo = [...repos].sort((a, b) => new Date(b.pushed) - new Date(a.pushed))[0];
  $("#lastRepoName").textContent = lastRepo.name;
  $("#lastRepoAbout").textContent = lastRepo.name;
  $("#lastWorked").hidden = false;
  tickSince();
}

function openRepo(name) {
  const search = $("#repoSearch");
  if (search.value) { search.value = ""; drawRepos(); }
  const row = $$(".repo").find((r) => $(".repo-name", r).textContent === name);
  const r = repos && repos.find((x) => x.name === name);
  if (!row || !r) return;
  if (!row.classList.contains("open")) toggleRepo(row, r);
  row.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
}
$("#lastWorked").addEventListener("click", () => lastRepo && openRepo(lastRepo.name));

$("#lastRepoAbout").addEventListener("click", () => {
  if (!lastRepo) return;
  const name = lastRepo.name;
  setTimeout(() => loadRepos().then(() => openRepo(name)), 650);
});

let musicSignature = null;
let updateSpotifyProgress = () => {};
const musicVisible = () => entered && !document.hidden && current === "about" && !$('[data-sub="music"]').hidden;
function renderMusic() {
  if (!musicVisible()) return;
  const el = $("#musicList");
  if (!el) return;
  const signature = JSON.stringify(spotify);
  if (musicSignature === signature) return updateSpotifyProgress();
  musicSignature = signature;
  updateSpotifyProgress = () => {};
  const rows = [];
  const now = document.createElement(spotify ? "a" : "div");
  now.className = "row";
  if (spotify) {
    now.href = `https://open.spotify.com/track/${encodeURIComponent(spotify.track_id)}`;
    now.target = "_blank";
    now.rel = "noopener";
    now.innerHTML = `<img alt="" /><div><b></b><span></span><small class="live">● now playing</small><div class="sp-progress"><i></i></div></div><em class="tagr">spotify ↗</em>`;
    $("img", now).src = spotify.album_art_url;
    $("b", now).textContent = spotify.song;
    $("span", now).textContent = spotify.artist;
    const { start, end } = spotify.timestamps || {};
    const bar = $(".sp-progress i", now);
    updateSpotifyProgress = () => {
      const progress = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100)) : 0;
      bar.style.width = `${progress}%`;
    };
    updateSpotifyProgress();
  } else {
    now.innerHTML = `<span class="ph">spotify<br>quiet</span><div><b>not listening</b><span>nothing is playing right now</span><small>spotify activity shows up here</small></div><em class="tagr"></em>`;
  }
  rows.push(now);
  el.replaceChildren(...rows);
}

const playedAgo = (t) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};
const HISTORY_URL = "https://listening-log.desmixo.workers.dev/";
let plays = null;
const historyCache = createAsyncCache({ ttl: 30000 });
const historyRows = new Map();

const samePlay = (a, b) => a.id === b.id && Math.abs(a.start - b.start) < 5000;

function mergePlays(a, b) {
  const out = [...a];
  for (const p of b) if (!out.some((q) => samePlay(p, q))) out.push(p);
  return out.sort((x, y) => y.start - x.start).slice(0, 50);
}

function notePlay(p) {
  if (!p) return;
  plays = mergePlays(plays || [], [p]);
}

async function loadHistory() {
  try {
    const history = await historyCache.get("history", async () => {
      const r = await request(HISTORY_URL);
      if (!r.ok) throw new Error(r.status);
      const data = r.json();
      if (!Array.isArray(data)) throw new Error("Invalid history");
      return data.filter((p) => p && typeof p.id === "string" && Number.isFinite(p.start) && p.start > 0);
    });
    plays = mergePlays(history, plays || []);
  } catch {
    if (!plays) $("#historyList").innerHTML = '<p class="empty">couldn\'t load listening history right now.</p>';
    return;
  }
  renderHistory();
}

function renderHistory() {
  if (!musicVisible()) return;
  const el = $("#historyList");
  if (!el || !plays) return;

  const currentPlay = spotify && playFrom(spotify);
  const items = plays.filter((p) => !currentPlay || !samePlay(p, currentPlay));
  $("#histCount").textContent = items.length ? `· ${items.length}` : "";
  if (!items.length) {
    el.innerHTML = plays.length
      ? '<p class="empty">just getting started. songs land here once the next one starts.</p>'
      : '<p class="empty">nothing logged yet. songs show up here after they play.</p>';
    return;
  }
  const activeKeys = new Set();
  const rows = items.map((p) => {
    const key = `${p.id}:${p.start}`;
    activeKeys.add(key);
    let a = historyRows.get(key);
    if (!a) {
      a = document.createElement("a");
      a.className = "row";
      a.href = `https://open.spotify.com/track/${encodeURIComponent(p.id)}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `<img alt="" loading="lazy" /><div><b></b><span></span></div><em class="tagr"></em>`;
      historyRows.set(key, a);
    }
    if ($("img", a).getAttribute("src") !== p.art) $("img", a).src = p.art;
    if ($("b", a).textContent !== p.song) $("b", a).textContent = p.song;
    if ($("span", a).textContent !== p.artist) $("span", a).textContent = p.artist;
    $(".tagr", a).textContent = playedAgo(p.start);
    return a;
  });
  for (const key of historyRows.keys()) if (!activeKeys.has(key)) historyRows.delete(key);
  if (el.children.length !== rows.length || rows.some((row, i) => el.children[i] !== row)) el.replaceChildren(...rows);
}

const audio = $("#audio");
const MUSIC_VOLUME = 0.15;
const TRACK = "/assets/music/background.mp3";

let fadeTimer;
function fadeTo(target, ms = 1800) {
  clearInterval(fadeTimer);
  const from = audio.volume, t0 = Date.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    audio.volume = from + (target - from) * k;
    if (k >= 1) {
      clearInterval(fadeTimer);
      if (target === 0) audio.pause();
    }
  }, 50);
}
function showMusic() {
  $("#soundBtn").setAttribute("aria-pressed", settings.music);
  $("#soundState").textContent = settings.music ? "music on" : "music off";
  $('[data-setting="music"]').checked = settings.music;
}
let waitingForGesture = false;
let musicStarting = false;
async function startMusic() {
  if (!entered || !settings.music || musicStarting) return;
  if (!audio.getAttribute("src")) audio.src = TRACK;
  musicStarting = true;
  if (audio.paused) audio.volume = 0;
  try {
    await audio.play();
    if (!settings.music) { audio.pause(); return; }
    fadeTo(MUSIC_VOLUME);
  } catch (error) {

    if (waitingForGesture || error.name !== "NotAllowedError") return;
    waitingForGesture = true;
    const go = () => {
      ["pointerdown", "keydown", "touchend"].forEach((ev) => removeEventListener(ev, go, true));
      waitingForGesture = false;
      if (settings.music) startMusic();
    };
    ["pointerdown", "keydown", "touchend"].forEach((ev) => addEventListener(ev, go, true));
  } finally {
    musicStarting = false;
  }
}
function setMusic(on) {
  settings.music = on;
  saveSettings();
  showMusic();
  if (on) startMusic();
  else fadeTo(0, 500);
}
$("#soundBtn").addEventListener("click", () => setMusic(!settings.music));
showMusic();

["pointerdown", "keydown"].forEach((ev) =>
  addEventListener(ev, () => {
    if (!entered || !settings.music || !audio.src) return;
    if (audio.paused) startMusic();
    else if (audio.volume < MUSIC_VOLUME * 0.5) fadeTo(MUSIC_VOLUME, 600);
  }, true)
);

function applySettings() {
  body.classList.toggle("calm", reducedMotion());
  if (reducedMotion()) brand.getAnimations().forEach((animation) => animation.cancel());
  sfx.enabled = settings.sfx;
  applyVideo();
  $$("[data-setting]").forEach((i) => (i.checked = !!settings[i.dataset.setting]));
}
$$("[data-setting]").forEach((i) =>
  i.addEventListener("change", () => {
    if (i.dataset.setting === "music") return setMusic(i.checked);
    settings[i.dataset.setting] = i.checked;
    saveSettings();
    applySettings();
  })
);
motionPreference.addEventListener("change", applySettings);

function applyVideo() {
  const v = $("#bg");
  if (entered && !document.hidden && settings.video && !reducedMotion()) {
    if (!v.getAttribute("src")) v.src = "/assets/video/rikka.mp4";
    v.play().catch(() => {});
  }
  else v.pause();
}

let displayTimer, displayCadence = 0;
let historyTimer, historyActive = false, historyGeneration = 0;
function syncHistory(active) {
  if (historyActive === active) return;
  historyActive = active;
  const generation = ++historyGeneration;
  clearTimeout(historyTimer);
  if (!active) return;
  const poll = async () => {
    await loadHistory();
    if (historyActive && generation === historyGeneration) historyTimer = setTimeout(poll, 30000);
  };
  poll();
}
function updateVisibleClocks() {
  const aboutMe = current === "about" && !$('[data-sub="me"]').hidden;
  tick(aboutMe);
  if (aboutMe || current === "repos") tickSince();
  if (musicVisible()) updateSpotifyProgress();
}
function scheduleDisplayTick() {
  if (!displayCadence) return;
  displayTimer = setTimeout(() => {
    updateVisibleClocks();
    scheduleDisplayTick();
  }, displayCadence - Date.now() % displayCadence);
}
function syncRuntime() {
  if (!runtimeReady) return;
  const visible = entered && !document.hidden;
  $("#home").inert = !entered || !!current;
  column.inert = !entered || !current;
  $$(".corner").forEach((corner) => { corner.inert = !entered; });
  applyVideo();
  syncPresence(visible);
  const showMusicPanel = musicVisible();
  syncHistory(showMusicPanel);
  if (visible) {
    if (current === "about" && !showMusicPanel) loadContributions();
    if (current === "about" || current === "repos") loadRepos();
    if (showMusicPanel) { renderMusic(); renderHistory(); }
    updateVisibleClocks();
  }
  const cadence = !visible ? 0 : current === "about" || current === "repos" ? 1000 : 60000;
  if (cadence !== displayCadence) {
    clearTimeout(displayTimer);
    displayCadence = cadence;
    if (cadence) scheduleDisplayTick();
  }
}
document.addEventListener("visibilitychange", syncRuntime);
addEventListener("pagehide", () => {
  syncPresence(false);
  syncHistory(false);
  clearTimeout(displayTimer);
  displayCadence = 0;
  $("#bg").pause();
});
addEventListener("pageshow", syncRuntime);
runtimeReady = true;
applySettings();
syncRuntime();

{
  const h = location.hash.slice(1);
  if (SECTIONS.includes(h)) go(h, { push: false });
}
