import {
  profile, watchPresence, getHistory, getRepos, getContributions, contributionWeeks,
  ago, since, birthdayCountdown, songProgress, pad,
} from "./data.js";

const $ = (id) => document.getElementById(id);
function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false && c !== "") n.append(c);
  return n;
}
const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter((c) => c != null && c !== false && c !== ""));
const ext = (href, kids, props = {}) => h("a", { href, target: "_blank", rel: "noopener noreferrer", ...props }, kids);
const icon = (name) => h("span", { class: "msym", "aria-hidden": "true", text: name });
const dim = (text, tag = "p") => h(tag, { class: "dim", text });
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const wall = $("wall");
if (reduceMotion.matches) wall.removeAttribute("autoplay"), wall.pause();

const workspaces = $("workspaces");
const wsNav = $("ws");
const wsBtns = [...wsNav.querySelectorAll("button")];
const wsSections = [...workspaces.children];
const focused = wsSections.map((s) => s.querySelector(".win"));
let current = 0;

function focusWin(win) {
  const i = wsSections.indexOf(win.closest(".workspace"));
  for (const w of wsSections[i].querySelectorAll(".win")) w.classList.toggle("active", w === win);
  focused[i] = win;
  if (i === current) $("wintitle").textContent = win.dataset.title;
}

function setWorkspace(i) {
  current = i;
  workspaces.style.setProperty("--ws", i);
  wsNav.style.setProperty("--i", i);
  wsBtns.forEach((b, j) => b.toggleAttribute("aria-current", j === i) || b.setAttribute("aria-current", j === i));
  wsSections.forEach((s, j) => (s.inert = j !== i));
  focusWin(focused[i]);
}
wsBtns.forEach((b, i) => b.addEventListener("click", () => setWorkspace(i)));
document.querySelectorAll(".win").forEach((w) => w.addEventListener("pointerdown", () => focusWin(w)));
setWorkspace(0);

$("desk").addEventListener("wheel", (e) => {
  if (innerWidth <= 760 || Math.abs(e.deltaY) < 40) return;
  if (e.target.closest(".win-body") && e.target.closest(".win-body").scrollHeight > e.target.closest(".win-body").clientHeight) return;
  if (e.timeStamp - (setWorkspace.last || 0) < 700) return;
  setWorkspace.last = e.timeStamp;
  markHinted();
  setWorkspace(Math.max(0, Math.min(wsSections.length - 1, current + Math.sign(e.deltaY))));
}, { passive: true });

const dash = $("dash");
const dashTriggers = [$("logo"), $("clock")];
let dashHover = false;
function setDash(open, viaHover = false) {
  dash.classList.toggle("open", open);
  dash.inert = !open;
  dashHover = open && viaHover;
  $("logo").setAttribute("aria-expanded", open);
}
dashTriggers.forEach((b) => b.addEventListener("click", () => setDash(!dash.classList.contains("open"))));
$("hot").addEventListener("mouseenter", () => { if (!dash.classList.contains("open")) setDash(true, true); });
dash.addEventListener("mouseleave", () => { if (dashHover) setDash(false); });
document.addEventListener("pointerdown", (e) => {
  if (dash.classList.contains("open") && !dash.contains(e.target) && !dashTriggers.some((b) => b.contains(e.target))) setDash(false);
});

const screen = document.querySelector(".screen");
const lock = $("lock");
const field = $("login-field");
const loginMsg = $("login-msg");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let loginRun = 0;
let loggingIn = false;
let hurry = false;
let firstLogin = true;

function setLocked() {
  loginRun++;
  loggingIn = false;
  setDash(false);
  hideToast();
  screen.inert = true;
  screen.classList.remove("enter");
  lock.classList.remove("boot");
  lock.classList.add("on");
  lock.removeAttribute("aria-hidden");
  field.className = "login-field";
  $("dots").replaceChildren();
  $("login-icon").textContent = "lock";
  loginMsg.textContent = "click or press any key to log in";
}

async function login() {
  if (loggingIn) { hurry = true; return; }
  loggingIn = true;
  hurry = reduceMotion.matches;
  const run = ++loginRun;
  const wait = (ms) => sleep(hurry ? Math.min(ms, 60) : ms);
  const alive = () => run === loginRun;
  field.className = "login-field focus";
  loginMsg.textContent = "";
  const dots = $("dots");
  dots.replaceChildren();
  await wait(firstLogin ? 650 : 250);
  for (let i = 0; i < 9 && alive(); i++) {
    const d = h("i");
    d.style.setProperty("--d", i);
    dots.append(d);
    await wait(55 + Math.random() * 70);
  }
  if (!alive()) return;
  await wait(220);
  field.className = "login-field focus busy";
  loginMsg.textContent = "authenticating…";
  await wait(850);
  if (!alive()) return;
  field.className = "login-field ok";
  $("login-icon").textContent = "check";
  loginMsg.textContent = `welcome back, ${profile.name}`;
  await wait(600);
  if (!alive()) return;
  wsSections[0].querySelectorAll(".win").forEach((w, i) => w.style.setProperty("--n", i));
  screen.classList.remove("enter");
  void screen.offsetWidth;
  screen.classList.add("enter");
  screen.inert = false;
  lock.classList.remove("on");
  lock.setAttribute("aria-hidden", "true");
  loggingIn = false;
  if (firstLogin) { firstLogin = false; setTimeout(showToast, hurry ? 200 : 1300); }
  setTimeout(() => lock.classList.remove("boot"), 800);
}

screen.inert = true;
$("power").addEventListener("click", setLocked);
lock.addEventListener("click", login);
setTimeout(login, 350);

const toast = $("toast");
let hinted = false;
let toastTimer = 0;
wsNav.classList.add("hint");
const armToastTimer = () => { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 12000); };
function showToast() {
  if (hinted) return;
  toast.inert = false;
  toast.classList.add("show");
  armToastTimer();
}
function hideToast() {
  clearTimeout(toastTimer);
  toast.classList.remove("show");
  toast.inert = true;
}
function markHinted() {
  if (hinted) return;
  hinted = true;
  wsNav.classList.remove("hint");
  setTimeout(hideToast, 900);
}
toast.addEventListener("pointerenter", () => clearTimeout(toastTimer));
toast.addEventListener("pointerleave", () => toast.classList.contains("show") && armToastTimer());
$("toast-x").addEventListener("click", () => { hideToast(); markHinted(); });
toast.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { setWorkspace(Number(b.dataset.go)); markHinted(); }));
wsBtns.forEach((b) => b.addEventListener("click", markHinted));

document.addEventListener("keydown", (e) => {
  if (lock.classList.contains("on")) { if (!e.repeat) login(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") return setDash(false);
  if (/^[1-4]$/.test(e.key)) { markHinted(); return setWorkspace(Number(e.key) - 1); }
  if (e.key === "d") return setDash(!dash.classList.contains("open"));
});

$("login-user").textContent = profile.name;
$("ff-host").textContent = `${profile.location}, us`;
$("ff-role").textContent = profile.tagline;
$("d-name").textContent = profile.name;
$("d-tag").textContent = `${profile.tagline} · ${profile.location}`;
$("d-bday-label").textContent = `turns ${profile.age + 1} in`;

const aboutLines = [
  { t: "# about", cls: "h" },
  { t: "" },
  ...profile.bio.flatMap((p, i) => (i ? [{ t: "" }, { t: p }] : [{ t: p }])),
  { t: "" },
  { t: `- based in ${profile.location}` },
  { t: "- currently: web dev, system administration" },
  { t: "- learning next: reverse engineering" },
];
put($("about"),
  aboutLines.map((l, i) => h("li", { class: i === 0 ? "cur" : null }, h("span", { class: "n", text: i + 1 }), h("span", { class: `t ${l.cls || ""}`, text: l.t || " " }))),
  Array.from({ length: 6 }, () => h("li", { class: "tl" }, h("span", { class: "n", text: "" }), h("span", { class: "t", text: "~" }))));

put($("socials"), profile.socials.map((s) => h("li", {},
  s.url
    ? ext(s.url, [h("span", { class: "k", text: s.name }), h("span", { class: "v", text: s.handle }), icon("north_east")], { "aria-label": `${s.name}: ${s.handle}` })
    : h("div", { class: "row" }, h("span", { class: "k", text: s.name }), h("span", { class: "v", text: s.handle })))));

const paParts = (opts) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts }).formatToParts(new Date()).map((p) => [p.type, p.value]));

function buildCalendar() {
  const p = paParts({ year: "numeric", month: "numeric", day: "numeric" });
  const y = Number(p.year), m = Number(p.month) - 1, today = Number(p.day);
  $("d-month").textContent = new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" }).toLowerCase();
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = ["s", "m", "t", "w", "t", "f", "s"].map((d) => h("span", { class: "wd", text: d }));
  for (let i = 0; i < lead; i++) cells.push(h("span", { class: "out", text: "" }));
  for (let d = 1; d <= days; d++) {
    const bd = m === profile.birthday.month - 1 && d === profile.birthday.day;
    cells.push(h("span", { class: [d === today ? "today" : "", bd ? "bd" : ""].join(" ").trim() || null, title: bd ? "birthday" : null, text: d }));
  }
  put($("d-cal"), cells);
}
buildCalendar();

let presence = null;
let np = null;
let lastPushed = null;
let log = null;
let lastSpotifyId;

const avatar = (p, size) => (p?.avatar ? h("img", { src: p.avatar, alt: "", width: size, height: size }) : h("span", { class: "ph" }));
const sdot = (p) => h("span", { class: "sdot", style: `background:${p ? p.status.color : "var(--on-2)"}`, "aria-hidden": "true" });

function renderPresence(p) {
  $("tray-dot").style.background = p.status.color;
  $("tray-dot").title = `discord: ${p.status.label}`;
  put($("ff-status"), sdot(p), p.status.label, p.customStatus ? h("span", { class: "dim", text: ` — ${p.customStatus}` }) : null);
  put($("d-status"), sdot(p), p.status.label);
  put($("d-avatar"), avatar(p, 64));
  if (p.avatar && !$("login-av").querySelector("img")) put($("login-av"), h("img", { src: p.avatar, alt: "", width: 96, height: 96 }));

  const bubble = p.customStatus
    || (p.activity ? `playing ${p.activity.name}` : null)
    || (p.spotify ? `listening to ${p.spotify.song}` : null);
  const joined = new Date(Number((BigInt(p.id) >> 22n) + 1420070400000n))
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const sec = (title, ...kids) => h("div", { class: "dc-sec" }, h("h3", { text: title }), kids);
  const copy = h("button", { type: "button", class: "dc-icon", "aria-label": `copy username ${p.username}`, title: "copy username" }, icon("content_copy"));
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(p.username); copy.firstChild.textContent = "check"; } catch {}
    setTimeout(() => (copy.firstChild.textContent = "content_copy"), 1400);
  });
  put($("discord"),
    h("div", { class: "dp" },
      h("div", { class: "dp-banner" }),
      h("div", { class: "dp-main" },
        h("div", { class: "dc-top" },
          h("div", { class: "dc-av" }, avatar(p, 88), h("span", { class: "sdot", style: `background:${p.status.color}`, title: p.status.label })),
          bubble ? h("p", { class: "dc-bubble", text: bubble, title: bubble }) : null),
        h("p", { class: "dc-name", text: p.displayName }),
        h("p", { class: "dc-sub" }, h("span", { text: p.username }), h("span", { class: "dc-dot", "aria-hidden": "true", text: "•" }), h("span", { text: profile.pronouns })),
        h("div", { class: "dc-actions" },
          ext(`https://discord.com/users/${p.id}`, [icon("chat_bubble"), "Message"], { class: "dc-msg" }),
          copy),
        sec("bio", ...profile.discordBio.map((line) => /^https?:\/\//.test(line) ? h("p", {}, ext(line, line, { class: "dc-link" })) : h("p", { text: line }))),
        sec("member since", h("p", { class: "dc-since" }, icon("calendar_month"), joined)))));
}

function renderNow(sp) {
  $("tray-music").classList.toggle("on", !!sp);
  $("tray-music").title = sp ? `${sp.song} — ${sp.artist}` : "not listening";
  cava.playing = !!sp;
  $("cava-cap").textContent = sp ? `♪ ${sp.song} — ${sp.artist}` : "idle · nothing playing";
  if (!sp) {
    np = null;
    put($("ff-music"), h("span", { class: "dim", text: "nothing playing" }));
    put($("player"), h("div", { class: "idle" }, icon("headphones"), h("p", { text: "not listening right now" }), dim("recent tracks are just below")));
    put($("d-media"), h("span", { class: "ph" }), h("div", { class: "info" }, h("b", { text: "nothing playing" }), dim("spotify is quiet")));
    return;
  }
  put($("ff-music"), ext(sp.url, `${sp.song} — ${sp.artist}`));
  if (np && np.sp.id === sp.id && np.sp.start === sp.start) { np.sp = sp; tickNow(); return; }
  const art = (size, cls) => (sp.art ? h("img", { src: sp.art, alt: `cover of ${sp.album || sp.song}`, width: size, height: size, class: cls }) : h("span", { class: `ph ${cls || ""}` }));
  const bar = () => h("div", { class: "bar-track", role: "progressbar", "aria-label": "track progress", "aria-valuemin": 0, "aria-valuemax": 100 }, h("span"));
  put($("player"),
    h("div", { class: "np" },
      art(300, "np-art"),
      h("div", { style: "min-width:0" },
        ext(sp.url, sp.song, { class: "np-song" }),
        h("p", { class: "np-artist", text: sp.artist }),
        h("p", { class: "np-album dim", text: sp.album || "single" }),
        bar(),
        h("p", { class: "np-time" }, h("span", { "data-el": "" }), h("span", { "data-total": "" })),
        ext(sp.url, [icon("north_east"), "open in spotify"], { class: "chip" }))));
  put($("d-media"),
    art(64),
    h("div", { class: "info" },
      h("b", { text: sp.song }), dim(sp.artist),
      bar()));
  np = { sp };
  tickNow();
}

function tickNow() {
  if (!np) return;
  const { sp } = np;
  const p = songProgress(sp);
  for (const b of document.querySelectorAll(".bar-track")) {
    b.firstChild.style.transform = `scaleX(${p})`;
    b.setAttribute("aria-valuenow", Math.round(p * 100));
  }
  const dur = sp.end ? sp.end - sp.start : 0;
  for (const e of document.querySelectorAll("[data-el]")) e.textContent = mmss(dur ? Math.min(Date.now() - sp.start, dur) : Date.now() - sp.start);
  for (const e of document.querySelectorAll("[data-total]")) e.textContent = dur ? mmss(dur) : "–:––";
}

function renderLog() {
  if (log === null) return;
  let list = log;
  if (list[0] && presence?.spotify && list[0].id === presence.spotify.id) list = list.slice(1);
  list = list.slice(0, 12);
  put($("hist"), list.length ? list.map((t) => h("li", {}, ext(t.url, [
    t.art ? h("img", { src: t.art, alt: "", width: 40, height: 40, loading: "lazy" }) : h("span", { class: "ph" }),
    h("span", { style: "min-width:0" }, h("b", { text: t.song }), h("i", { text: t.artist })),
    h("time", { datetime: new Date(t.start).toISOString(), text: ago(t.start) }),
  ], { "aria-label": `${t.song} by ${t.artist}, ${ago(t.start)}` }))) : dim("nothing in the log right now.", "li"));
}

const presenceTimeout = setTimeout(() => {
  if (presence) return;
  put($("ff-status"), h("span", { class: "dim", text: "unavailable" }));
  put($("discord"), dim("discord presence is unreachable right now."));
  renderNow(null);
}, 12000);

watchPresence((p) => {
  clearTimeout(presenceTimeout);
  presence = p;
  renderPresence(p);
  renderNow(p.spotify);
  const id = p.spotify?.id ?? null;
  if (id !== lastSpotifyId) { lastSpotifyId = id; renderLog(); }
});

function renderStats() {
  if (!log.length) {
    put($("top"), dim("nothing in the log yet.", "li"));
    put($("covers"), dim("no covers yet."));
    return;
  }
  const artists = new Map();
  for (const t of log) {
    for (const a of t.artist.split(/;\s*|,\s*/).map((s) => s.trim()).filter(Boolean)) artists.set(a, (artists.get(a) || 0) + 1);
  }
  const ranked = [...artists].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = ranked[0][1];
  const ms = log.reduce((sum, t) => sum + (t.end && t.end > t.start ? Math.min(t.end - t.start, 600000) : 0), 0);
  const mins = Math.round(ms / 60000);
  $("top-meta").textContent = `${log.length} plays · ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}`;
  put($("top"), ranked.map(([name, n], i) => h("li", {},
    h("span", { class: "rk", text: i + 1 }),
    h("span", { class: "nm", text: name }),
    h("span", { class: "ct", text: `${n} play${n === 1 ? "" : "s"}` }),
    h("span", { class: "meter", style: `--p:${Math.max(6, (n / max) * 100)}%`, "aria-hidden": "true" }, h("span")))));

  const albums = new Map();
  for (const t of log) {
    if (!t.art) continue;
    const a = albums.get(t.art);
    if (a) a.plays++;
    else albums.set(t.art, { ...t, plays: 1 });
  }
  const covers = [...albums.values()];
  $("wall-meta").textContent = `${covers.length} covers`;
  put($("covers"), covers.map((t) => ext(t.url, [
    h("img", { src: t.art, alt: "", loading: "lazy", width: 160, height: 160 }),
    t.plays > 1 ? h("span", { class: "plays", text: `×${t.plays}` }) : null,
    h("span", { class: "cap" }, h("b", { text: t.album || t.song }), h("i", { text: t.artist })),
  ], { "aria-label": `${t.album || t.song} by ${t.artist}` })));
}

getHistory().then((list) => { log = Array.isArray(list) ? list : []; renderLog(); renderStats(); });
setInterval(() => getHistory().then((list) => { if (Array.isArray(list) && list.length) { log = list; renderLog(); renderStats(); } }), 120000);
setInterval(renderLog, 30000);

getContributions().then(({ total, days }) => {
  const weeks = contributionWeeks(days);
  const months = h("div", { class: "cal-m", "aria-hidden": "true" });
  const grid = h("div", { class: "cal-g", role: "img", "aria-label": `${total} contributions in the last year` });
  let prevMonth = -1, lastLabel = -9;
  weeks.forEach((w, i) => {
    const first = w.find(Boolean);
    if (first) {
      const d = new Date(first.date + "T00:00");
      if (d.getMonth() !== prevMonth) {
        prevMonth = d.getMonth();
        if (i - lastLabel >= 3 && i < weeks.length - 2) {
          const m = h("span", { text: d.toLocaleString("en-US", { month: "short" }).toLowerCase() });
          m.style.gridColumn = `${i + 1} / span 3`;
          months.append(m);
          lastLabel = i;
        }
      }
    }
    for (let r = 0; r < 7; r++) {
      const c = w[r];
      grid.append(c ? h("span", { class: `c l${c.level}`, title: `${c.count} contribution${c.count === 1 ? "" : "s"} on ${c.date}` }) : h("span", { class: "c pad" }));
    }
  });
  months.style.setProperty("--weeks", weeks.length);
  grid.style.setProperty("--weeks", weeks.length);
  const scroller = h("div", { class: "cal-scroll", tabindex: 0, "aria-label": "contribution calendar" }, months, grid);
  put($("contrib"),
    h("div", { class: "act-top" },
      h("p", {}, h("b", { text: total.toLocaleString("en-US") }), h("span", { class: "dim", text: " contributions in the last year" })),
      h("div", { class: "legend", "aria-hidden": "true" }, h("span", { class: "t", text: "less" }), [0, 1, 2, 3, 4].map((l) => h("span", { class: `c l${l}` })), h("span", { class: "t", text: "more" }))),
    scroller);
  scroller.scrollLeft = scroller.scrollWidth;
}).catch(() => put($("contrib"), dim("couldn't load the contribution calendar from github.")));

getRepos().then((repos) => {
  if (!repos.length) {
    put($("repos"), dim("no public repositories yet.", "li"));
    put($("ff-last"), h("span", { class: "dim", text: "nothing yet" }));
    return;
  }
  const last = repos[0];
  lastPushed = last.pushed;
  $("repo-count").textContent = `${repos.length} items`;
  const langs = new Set(repos.map((r) => r.language).filter(Boolean)).size;
  $("ff-pkgs").textContent = `${repos.length} (github), ${langs} languages`;
  put($("last"), h("span", { class: "k", text: "last worked on" }), ext(last.url, last.name),
    h("span", {}, h("time", { class: "tick", id: "since", datetime: last.pushed, text: since(last.pushed) }), h("span", { class: "dim", text: " ago" })));
  put($("ff-last"), ext(last.url, last.name), h("span", { class: "dim", text: ` · ${ago(last.pushed)}` }));
  put($("repos"), repos.map((r) => h("li", {},
    ext(r.url, r.name, { class: "name", title: r.description || r.name }),
    h("span", { class: "desc", text: r.description || "—" }),
    h("span", { class: "lang" }, r.language ? [h("i", { style: `background:${r.languageColor}` }), r.language] : ""),
    h("span", { class: "st" }, r.stars > 0 ? `★ ${r.stars}` : ""),
    h("time", { datetime: r.pushed, text: ago(r.pushed) }))));
}).catch(() => {
  put($("repos"), dim("github didn't answer. try again shortly.", "li"));
  $("ff-pkgs").textContent = "unavailable";
  put($("ff-last"), h("span", { class: "dim", text: "unavailable" }));
  put($("last"), h("span", { class: "k", text: "last worked on" }), dim("unavailable", "span"));
});

const cava = { playing: false, bars: [], lvl: [] };
{
  const el = $("cava");
  const n = 36;
  for (let i = 0; i < n; i++) { const s = h("span"); el.append(s); cava.bars.push(s); cava.lvl.push(0.04); }
  let prev = 0;
  const frame = (ts) => {
    requestAnimationFrame(frame);
    if (document.hidden || current !== 2 || ts - prev < 33) return;
    prev = ts;
    cava.bars.forEach((b, i) => {
      const shape = 1 - (i / n) * 0.5;
      const target = cava.playing && !reduceMotion.matches
        ? Math.min(1, (0.18 + 0.82 * Math.abs(Math.sin(ts / 420 + i * 0.63) * Math.sin(ts / 690 + i * 1.7))) * shape * (0.65 + Math.random() * 0.35))
        : cava.playing ? 0.3 * shape : 0.04;
      cava.lvl[i] += (target - cava.lvl[i]) * 0.3;
      b.style.transform = `scaleY(${cava.lvl[i].toFixed(3)})`;
    });
  };
  requestAnimationFrame(frame);
}

function tick() {
  const t = paParts({ hour: "2-digit", minute: "2-digit", hour12: true });
  const hh = t.hour.padStart(2, "0"), mm = t.minute, ap = t.dayPeriod.toLowerCase();
  $("hh").textContent = hh;
  $("mm").textContent = mm;
  $("clock").setAttribute("aria-label", `${Number(hh)}:${mm} ${ap} in pennsylvania, open dashboard`);
  $("d-clock").textContent = `${Number(hh)}:${mm}`;
  $("lock-time").textContent = `${Number(hh)}:${mm}`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date()).toLowerCase();
  $("d-date").textContent = `${ap} · ${date}`;
  $("lock-date").textContent = date;
  $("ff-time").textContent = `${Number(hh)}:${mm} ${ap} est`;
  const bday = birthdayCountdown();
  $("ff-bday").textContent = `${bday.days}d ${pad(bday.hours)}h ${pad(bday.minutes)}m (turning ${profile.age + 1})`;
  const now = new Date();
  let lastBday = new Date(now.getFullYear(), profile.birthday.month - 1, profile.birthday.day);
  if (lastBday > now) lastBday = new Date(now.getFullYear() - 1, profile.birthday.month - 1, profile.birthday.day);
  const up = Math.floor((now - lastBday) / 1000);
  $("ff-uptime").textContent = `${profile.age} years, ${Math.floor(up / 86400)} days, ${Math.floor((up % 86400) / 3600)} hours`;
  $("d-bday").textContent = bday.text;
  const s = $("since");
  if (s && lastPushed) s.textContent = since(lastPushed);
  tickNow();
}
tick();
setInterval(tick, 1000);
setInterval(buildCalendar, 600000);
