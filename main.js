import {
  profile, watchPresence, getHistory, getRepos, getContributions, contributionWeeks,
  ago, since, birthdayCountdown, pennsylvaniaTime, songProgress, pad,
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
const msg = (text, tag = "p") => h(tag, { class: "status-msg", text });
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
const fullUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const dot = (p) => h("span", { class: p && p.status.label === "online" ? "dot live" : "dot", "aria-hidden": "true" });

const bodies = [...document.querySelectorAll(".body")];
const fade = (el) => el.classList.toggle("more", el.scrollHeight - el.scrollTop - el.clientHeight > 4);
const refade = () => requestAnimationFrame(() => bodies.forEach(fade));
bodies.forEach((b) => b.addEventListener("scroll", () => fade(b), { passive: true }));
addEventListener("resize", refade);

$("name").textContent = profile.name;
$("tagline").textContent = profile.tagline;
$("loc").textContent = profile.location;
put($("bio"), ...profile.bio.map((s) => h("p", { text: s })));
$("bday-label").textContent = `turns ${profile.age + 1} in`;
put($("socials"), ...profile.socials.map((s) =>
  h("li", {},
    h("span", { class: "k", text: s.name }),
    s.url ? ext(s.url, s.handle, { "aria-label": `${s.name}: ${s.handle}` }) : h("span", { text: s.handle }))
));
refade();

let presence = null;
let lastSpotifyId;
let np = null;
let lastPushed = null;
let history = null;

function renderStatus(p) {
  put($("status"), dot(p), h("span", { text: p.status.label }),
    p.customStatus ? h("span", { class: "muted", text: ` — ${p.customStatus}` }) : null);
}

function renderDiscord(p) {
  const img = p.avatar ? h("img", { src: p.avatar, alt: `${p.username}'s discord avatar`, width: 36, height: 36 }) : null;
  let act = null;
  if (p.activity) act = h("p", {}, "playing ", h("span", { text: p.activity.name }), p.activity.detail ? h("span", { class: "muted", text: ` · ${p.activity.detail}` }) : null);
  else if (p.spotify) act = h("p", { class: "muted", text: "listening on spotify" });
  put($("discord"), img,
    h("div", { style: "min-width:0" },
      h("p", { class: "who", text: p.username }),
      h("p", {}, dot(p), p.status.label),
      p.customStatus ? h("p", { class: "muted", text: p.customStatus }) : null,
      act));
}

function renderNow(sp) {
  const body = $("np");
  if (!sp) {
    np = null;
    put(body, msg("not listening to anything right now."), h("p", { class: "muted np-sub", text: "the last few tracks are under recent." }));
    return;
  }
  if (np && np.sp.id === sp.id && np.sp.start === sp.start) { np.sp = sp; tickNow(); return; }
  const fill = h("span");
  const bar = h("div", { class: "bar", role: "progressbar", "aria-label": "track progress", "aria-valuemin": 0, "aria-valuemax": 100 }, fill);
  const elapsed = h("time");
  const total = h("time");
  put(body, 
    h("div", { class: "np" },
      sp.art ? h("img", { src: sp.art, alt: `cover of ${sp.album || sp.song}`, width: 64, height: 64 }) : h("span", { class: "np-ph" }),
      h("div", { style: "min-width:0" },
        ext(sp.url, sp.song, { class: "np-song" }),
        h("p", { class: "np-sub", text: sp.artist }),
        h("p", { class: "np-sub muted", text: sp.album || "single" }))),
    bar,
    h("p", { class: "np-time" }, elapsed, total));
  np = { sp, fill, bar, elapsed, total };
  tickNow();
}

function tickNow() {
  if (!np) return;
  const { sp } = np;
  const p = songProgress(sp);
  np.fill.style.transform = `scaleX(${p})`;
  np.bar.setAttribute("aria-valuenow", Math.round(p * 100));
  const dur = sp.end ? sp.end - sp.start : 0;
  np.elapsed.textContent = clock(dur ? Math.min(Date.now() - sp.start, dur) : Date.now() - sp.start);
  np.total.textContent = dur ? clock(dur) : "–:––";
}

function renderHistory() {
  if (history === null) return;
  let list = history;
  if (list[0] && presence?.spotify && list[0].id === presence.spotify.id) list = list.slice(1);
  list = list.slice(0, 8);
  put($("hist"), ...(list.length ? list.map((t) =>
    h("li", {}, ext(t.url, [
      t.art ? h("img", { src: t.art, alt: "", width: 26, height: 26, loading: "lazy" }) : h("span", { class: "ph" }),
      h("span", { style: "min-width:0" }, h("b", { text: t.song }), h("i", { text: t.artist })),
      h("time", { datetime: new Date(t.start).toISOString(), text: ago(t.start) }),
    ], { "aria-label": `${t.song} by ${t.artist}, ${ago(t.start)}` }))
  ) : [msg("nothing in the log right now.", "li")]));
  refade();
}

const presenceTimeout = setTimeout(() => {
  if (presence) return;
  put($("status"), dot(null), h("span", { class: "muted", text: "status unavailable" }));
  put($("discord"), msg("discord presence is unreachable right now."));
  put($("np"), msg("couldn't reach spotify via discord."));
  refade();
}, 12000);

watchPresence((p) => {
  clearTimeout(presenceTimeout);
  presence = p;
  renderStatus(p);
  renderDiscord(p);
  renderNow(p.spotify);
  const id = p.spotify?.id ?? null;
  if (id !== lastSpotifyId) { lastSpotifyId = id; renderHistory(); }
  refade();
});

getHistory().then((list) => { history = Array.isArray(list) ? list : []; renderHistory(); });
setInterval(renderHistory, 30000);

getContributions().then(({ total, days }) => {
  const weeks = contributionWeeks(days);
  const months = h("div", { class: "cal-m", "aria-hidden": "true" });
  const cal = h("div", { class: "cal", role: "img", "aria-label": `${total} contributions in the last year` });
  let prevMonth = -1;
  let lastLabel = -9;
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
      cal.append(c
        ? h("span", { class: `c l${c.level}`, title: `${c.count} contribution${c.count === 1 ? "" : "s"} on ${c.date}` })
        : h("span", { class: "c pad" }));
    }
  });
  months.style.setProperty("--weeks", weeks.length);
  cal.style.setProperty("--weeks", weeks.length);
  const scroller = h("div", { class: "cal-scroll", tabindex: 0, "aria-label": "contribution calendar" }, months, cal);
  put($("contrib"), 
    h("div", { class: "act-top" },
      h("p", {}, h("b", { text: total.toLocaleString("en-US") }), h("span", { class: "muted", text: " contributions in the last year" })),
      h("div", { class: "legend", "aria-hidden": "true" },
        h("span", { class: "t", text: "less" }),
        [0, 1, 2, 3, 4].map((l) => h("span", { class: `c l${l}` })),
        h("span", { class: "t", text: "more" }))),
    scroller);
  scroller.scrollLeft = scroller.scrollWidth;
  refade();
}).catch(() => {
  put($("contrib"), msg("couldn't load the contribution calendar from github."));
});

getRepos().then((repos) => {
  if (!repos.length) {
    put($("repos"), msg("no public repositories yet.", "li"));
    put($("last"), h("span", { class: "k", text: "last worked on" }), h("span", { class: "status-msg", text: "nothing yet" }));
    return;
  }
  const last = repos[0];
  lastPushed = last.pushed;
  $("repo-count").textContent = `(${repos.length})`;
  put($("last"), 
    h("span", { class: "k", text: "last worked on" }),
    ext(last.url, last.name),
    h("span", {}, h("time", { class: "tick", id: "since", datetime: last.pushed, text: since(last.pushed) }), h("span", { class: "muted", text: " ago" })));
  put($("repos"), ...repos.map((r) =>
    h("li", {},
      ext(r.url, r.name, { class: "name", title: r.description || r.name, "aria-label": `${r.name} on github` }),
      h("span", { class: "desc", text: r.description }),
      h("span", { class: "lang", text: r.language || "" }),
      h("span", { class: "st num" }, r.stars > 0 ? h("span", { "aria-label": `${r.stars} stars`, text: `★ ${r.stars}` }) : null),
      h("time", { datetime: r.pushed, text: ago(r.pushed) }),
      h("span", { class: "site" }, r.site ? ext(fullUrl(r.site), "site", { "aria-label": `${r.name} website` }) : null))
  ));
  refade();
}).catch(() => {
  put($("repos"), msg("github didn't answer. try again shortly.", "li"));
  put($("last"), h("span", { class: "k", text: "last worked on" }), h("span", { class: "status-msg", text: "unavailable" }));
});

function tick() {
  $("pa-time").textContent = pennsylvaniaTime();
  $("bday").textContent = birthdayCountdown().text;
  const s = $("since");
  if (s && lastPushed) s.textContent = since(lastPushed);
  tickNow();
}
tick();
setInterval(tick, 1000);

const topBar = document.querySelector(".top");
const navBtns = [...document.querySelectorAll(".nav-btn")];
const narrow = matchMedia("(max-width: 760px)");
const panelFor = (btn) => $(btn.getAttribute("aria-controls"));
let openBtn = null;

function placePanel(btn) {
  const panel = panelFor(btn);
  const box = topBar.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const center = b.left + b.width / 2 - box.left;
  const left = narrow.matches ? 0 : Math.max(0, Math.min(box.width - panel.offsetWidth, center - panel.offsetWidth / 2));
  panel.style.left = `${left}px`;
  panel.style.setProperty("--ox", `${center - left}px`);
}

function openPanel(btn) {
  for (const b of navBtns) {
    const on = b === btn;
    b.setAttribute("aria-expanded", on);
    panelFor(b).classList.toggle("open", on);
    panelFor(b).inert = !on;
  }
  if (btn) placePanel(btn);
  openBtn = btn;
  document.body.classList.toggle("panel-open", !!btn);
  refade();
}

for (const b of navBtns) b.addEventListener("click", () => openPanel(openBtn === b ? null : b));
document.addEventListener("pointerdown", (e) => { if (openBtn && !topBar.contains(e.target)) openPanel(null); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !openBtn) return;
  const b = openBtn;
  openPanel(null);
  b.focus();
});
addEventListener("resize", () => openBtn && placePanel(openBtn));

