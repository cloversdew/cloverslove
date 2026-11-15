/*
  listening log

  Cloudflare runs this once a minute (its fastest schedule). Each run checks
  Lanyard up to CHECKS times, about GAP ms apart, so short songs / quick
  skips can still get logged. New plays go to the
  front of a list in Workers KV (newest first, capped at MAX). The site
  fetches GET / to show "recently played".

  A "play" is a track + its start time, so the same song twice shows twice.
  KV is only written when something new starts. Waiting between checks
  doesn't use CPU time. Slow upstream responses are bounded so a run stops
  issuing work before the next minute's scheduled run.
*/
const MAX = 50;
const KEY = "history";
const CHECKS = 4;
const GAP = 14000;
const REQUEST_TIMEOUT = 5000;
const RUN_BUDGET = 55000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nowPlaying(env, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`, {
      headers: { "user-agent": "listening-log-worker" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const { success, data } = await res.json();
    if (!success || !data?.listening_to_spotify || !data.spotify) return null;
    const sp = data.spotify;
    const start = sp.timestamps?.start;
    // A new Date.now() fallback on every poll would turn one malformed play
    // into a new history entry every fourteen seconds. Wait for valid data.
    if (typeof sp.track_id !== "string" || !sp.track_id.trim()
      || !Number.isFinite(start) || start <= 0) return null;
    const end = sp.timestamps?.end;
    return {
      id: sp.track_id,
      song: sp.song,
      artist: sp.artist,
      album: sp.album,
      art: sp.album_art_url,
      start,
      end: Number.isFinite(end) && end >= start ? end : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const samePlay = (a, b) => a && b && a.id === b.id && Math.abs(a.start - b.start) < 5000;

async function record(env) {
  const deadline = Date.now() + RUN_BUDGET;
  // read once per run, then keep the list in memory between checks
  let history = (await env.LOG.get(KEY, "json")) || [];
  for (let i = 0; i < CHECKS; i++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const play = await nowPlaying(env, Math.min(REQUEST_TIMEOUT, remaining));
    if (Date.now() >= deadline) break;
    if (play && !samePlay(history[0], play)) {
      history = [play, ...history].slice(0, MAX);
      await env.LOG.put(KEY, JSON.stringify(history));
    }
    // Don't begin another gap/check when the current run has used its budget.
    // KV itself is not cancellable; check the budget again after each await.
    if (i < CHECKS - 1) {
      if (deadline - Date.now() <= GAP) break;
      await sleep(GAP);
    }
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(record(env));
  },

  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return new Response("method not allowed", { status: 405, headers: CORS });
    // cacheTtl 30 is the shortest KV allows; keeps reads fresh after a write
    const history = (await env.LOG.get(KEY, { type: "json", cacheTtl: 30 })) || [];
    return new Response(JSON.stringify(history), {
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=10",
      },
    });
  },
};
