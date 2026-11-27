export const profile = {
  name: "dylan",
  tagline: "cybersecurity student",
  location: "pennsylvania",
  age: 20,
  bio: [
    "hi ! i'm dylan! I am a 20 year old cybersecurity student in pennsylvania. I am currently focusing on web development and system administration, and would like to learn reverse engineering! I like to sometimes make cool little things for games I like or things I find useful.",
    "most of the time i'm listening to music or playing my car games, but I am free most of the time so feel free to say hi !",
  ],
  birthday: { month: 6, day: 12 },
  pronouns: "20yo | enby",
  discordBio: ["1 of 1", "https://tsundere.vip/"],
  github: "cloversdew",
  discordId: "262467539685212160",
  socials: [
    { name: "github", handle: "cloversdew", url: "https://github.com/cloversdew" },
    { name: "discogs", handle: "bypassing", url: "https://www.discogs.com/user/bypassing" },
    { name: "x", handle: "retrialed", url: "https://x.com/retrialed" },
    { name: "instagram", handle: "0mkx", url: "https://instagram.com/0mkx" },
    { name: "tiktok", handle: "zuxm", url: "https://tiktok.com/@zuxm" },
    { name: "telegram", handle: "retria1", url: "https://t.me/retria1" },
    { name: "discord", handle: "cloversdew", url: null },
  ],
};

const HISTORY_URL = "https://listening-log.desmixo.workers.dev/";

export const pad = (n) => String(n).padStart(2, "0");

export function ago(time) {
  const ms = Date.now() - new Date(time).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 2) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function since(time) {
  let s = Math.max(0, Math.floor((Date.now() - new Date(time).getTime()) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}

export function birthdayCountdown(now = new Date()) {
  const { month, day } = profile.birthday;
  let next = new Date(now.getFullYear(), month - 1, day);
  if (next <= now) next = new Date(now.getFullYear() + 1, month - 1, day);
  let s = Math.floor((next - now) / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return { days: d, hours: h, minutes: m, seconds: s, text: `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` };
}

export function pennsylvaniaTime(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true })
    .format(now)
    .toLowerCase();
}

const STATUS = {
  online: { label: "online", color: "#3ba55d" },
  idle: { label: "idle", color: "#faa81a" },
  dnd: { label: "do not disturb", color: "#ed4245" },
  offline: { label: "offline", color: "#747f8d" },
};

function shapePresence(d) {
  const u = d.discord_user || {};
  const acts = d.activities || [];
  const custom = acts.find((a) => a.type === 4);
  const act = acts.find((a) => a.type !== 4 && a.name !== "Spotify");
  const sp = d.listening_to_spotify ? d.spotify : null;
  return {
    status: STATUS[d.discord_status] || STATUS.offline,
    avatar: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : null,
    username: u.username || "cloversdew",
    displayName: u.global_name || u.display_name || u.username || "cloversdew",
    id: u.id || profile.discordId,
    customStatus: custom?.state || "",
    activity: act ? { name: act.name, detail: [act.details, act.state].filter(Boolean).join(" · ") } : null,
    spotify: sp
      ? {
          id: sp.track_id,
          song: sp.song,
          artist: sp.artist,
          album: sp.album,
          art: sp.album_art_url,
          start: sp.timestamps?.start ?? Date.now(),
          end: sp.timestamps?.end ?? null,
          url: `https://open.spotify.com/track/${encodeURIComponent(sp.track_id)}`,
        }
      : null,
  };
}

export function songProgress(spotify) {
  if (!spotify || !spotify.end) return 0;
  return Math.min(1, Math.max(0, (Date.now() - spotify.start) / (spotify.end - spotify.start)));
}

export function watchPresence(onUpdate) {
  let socket = null;
  let beat = null;
  let retry = 1000;
  let stopped = false;

  const poll = async () => {
    try {
      const j = await fetch(`https://api.lanyard.rest/v1/users/${profile.discordId}`).then((r) => r.json());
      if (j.success) onUpdate(shapePresence(j.data));
    } catch {}
  };

  const connect = () => {
    if (stopped) return;
    try { socket = new WebSocket("wss://api.lanyard.rest/socket"); } catch { return; }
    socket.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.op === 1) {
        beat = setInterval(() => socket?.readyState === 1 && socket.send(JSON.stringify({ op: 3 })), m.d.heartbeat_interval);
        socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: profile.discordId } }));
      } else if (m.op === 0 && (m.t === "INIT_STATE" || m.t === "PRESENCE_UPDATE")) {
        retry = 1000;
        onUpdate(shapePresence(m.d));
      }
    };
    socket.onclose = () => {
      clearInterval(beat);
      socket = null;
      if (!stopped) setTimeout(connect, (retry = Math.min(retry * 2, 30000)));
    };
  };

  poll();
  connect();
  const fallback = setInterval(() => { if (!socket || socket.readyState !== 1) poll(); }, 15000);
  return () => { stopped = true; clearInterval(fallback); clearInterval(beat); socket?.close(); };
}

export async function getHistory() {
  try {
    const r = await fetch(HISTORY_URL);
    if (!r.ok) return [];
    return (await r.json()).map((p) => ({ ...p, url: `https://open.spotify.com/track/${encodeURIComponent(p.id)}` }));
  } catch {
    return [];
  }
}

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", CSS: "#a978e6", HTML: "#e34c26", "C++": "#f34b7d",
  C: "#8d9bb0", Python: "#3572a5", Rust: "#dea584", Go: "#00add8", Lua: "#5b6cf0", Java: "#b07219", Shell: "#89e051",
};

let reposPromise = null;
export function getRepos() {
  if (!reposPromise) {
    reposPromise = (async () => {
      try {
        const cached = JSON.parse(sessionStorage.getItem("repos") || "null");
        if (cached && Date.now() - cached.t < 600000) return cached.data;
      } catch {}
      const r = await fetch(`https://api.github.com/users/${profile.github}/repos?sort=pushed&per_page=100`);
      if (!r.ok) throw new Error(`github ${r.status}`);
      const data = (await r.json())
        .filter((x) => !x.fork)
        .map((x) => ({
          name: x.name,
          description: x.description || "",
          language: x.language,
          languageColor: LANG_COLORS[x.language] || "#9aa",
          stars: x.stargazers_count,
          pushed: x.pushed_at,
          created: x.created_at,
          url: x.html_url,
          site: x.homepage || null,
        }))
        .sort((a, b) => new Date(b.pushed) - new Date(a.pushed));
      try { sessionStorage.setItem("repos", JSON.stringify({ t: Date.now(), data })); } catch {}
      return data;
    })().catch((e) => { reposPromise = null; throw e; });
  }
  return reposPromise;
}

export async function getContributions() {
  const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${profile.github}?y=last`);
  if (!r.ok) throw new Error(`contributions ${r.status}`);
  const j = await r.json();
  return { total: j.total?.lastYear ?? 0, days: j.contributions || [] };
}

export function contributionWeeks(days) {
  if (!days.length) return [];
  const lead = new Date(days[0].date + "T00:00").getDay();
  const cells = [...Array(lead).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
