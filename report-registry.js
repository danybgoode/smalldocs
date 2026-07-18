// report-registry.js — the resolver half of Miyagi's reporthub-as-notion Sprint 1: a read-through proxy
// from `/api/report/<slug>` to the public GCS bucket the root-repo report scripts write to
// (`infra/gcp/provision-report-registry.sh`, `scripts/lib/report-registry.mjs` in
// danybgoode/miyagi-product-management). This is deliberately NOT part of the stateful short-link system
// (short-links/db.js, gated behind SDOCS_ENABLE_STATEFUL_APIS) — it never touches SQLite, holds no state
// of its own, and stays available even with SDOCS_ENABLE_STATEFUL_APIS=0 (the PMO instance's permanent
// setting, per infra/gcp/pmo-smalldocs.md). A GCS read failure of any kind degrades to a 404 the client
// renders as a friendly "this link may have expired, the original URL-hash link still works" message —
// the registry is an additive read path, never a hard dependency.
//
// Slug -> object path convention (must match the writer side EXACTLY — see
// scripts/lib/report-registry.mjs and infra/gcp/provision-report-registry.sh's lifecycle rule in the
// root repo):
//   daily-story-YYYY-MM-DD-<hash6>  -> daily/daily-story-YYYY-MM-DD-<hash6>.md   (90d TTL)
//   pmo-weekly-YYYY-MM-DD           -> packets/pmo-weekly-YYYY-MM-DD.md          (kept forever)
//   pmo-monthly-YYYY-MM-DD          -> packets/pmo-monthly-YYYY-MM-DD.md         (kept forever)
//   pmo-sheet-YYYY-MM-DD            -> packets/pmo-sheet-YYYY-MM-DD.md           (kept forever)
// Any slug not starting with "daily-" lands under packets/ — the daily/ prefix is the only thing the
// bucket's lifecycle rule keys off, so anything not explicitly daily defaults to "kept forever".

const DEFAULT_BUCKET = 'miyagi-pmo-reports';
const DEFAULT_STORAGE_BASE_URL = 'https://storage.googleapis.com';

// Generous but bounded — every real slug this system mints is well under this (the longest today,
// `daily-story-YYYY-MM-DD-xxxxxx`, is 30 chars); this just keeps a malformed/hostile path from doing
// anything interesting before the regex rejects it.
const SLUG_RE = /^[A-Za-z0-9_-]{1,80}$/;

function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

function objectPathForSlug(slug) {
  return slug.startsWith('daily-') ? `daily/${slug}.md` : `packets/${slug}.md`;
}

// reporthub-as-notion S2.1: live/ — a well-known, repeatedly-overwritten JSON object the root repo's
// scripts/publish-live-views.mjs republishes on every run (scripts/lib/report-registry.mjs's
// `allowOverwrite`/`liveObjectPath`, the write-side counterpart). Same slug-shaped validation as a
// regular report slug — it's still a GCS object-key/URL path segment.
const LIVE_KEY_RE = /^[A-Za-z0-9_-]{1,80}$/;

function isValidLiveKey(key) {
  return typeof key === 'string' && LIVE_KEY_RE.test(key);
}

function liveObjectPath(key) {
  return `live/${key}.json`;
}

function resolveBucket(env = process.env) {
  return env.REPORT_REGISTRY_BUCKET || DEFAULT_BUCKET;
}

// Override point for tests only — points the resolver at a local fixture HTTP server instead of the real
// storage.googleapis.com, so `/api/report/<slug>` integration coverage runs fully offline. Never set in
// any deployed environment (infra/gcp/pmo-smalldocs.md documents no such env var for prod/staging).
function resolveStorageBaseUrl(env = process.env) {
  return env.REPORT_REGISTRY_STORAGE_BASE_URL || DEFAULT_STORAGE_BASE_URL;
}

function buildObjectUrl({ slug, env = process.env }) {
  const bucket = resolveBucket(env);
  const objectPath = objectPathForSlug(slug);
  return `${resolveStorageBaseUrl(env)}/${bucket}/${objectPath}`;
}

function buildLiveObjectUrl({ key, env = process.env }) {
  const bucket = resolveBucket(env);
  const objectPath = liveObjectPath(key);
  return `${resolveStorageBaseUrl(env)}/${bucket}/${objectPath}`;
}

// Fetches the report payload for `slug`. Returns one of:
//   { ok: true, text }
//   { ok: false, status: 400, reason: 'invalid_slug' }
//   { ok: false, status: 404, reason: 'not_found' }         — object doesn't exist (or expired off the
//                                                              daily/ 90d TTL)
//   { ok: false, status: 502, reason: 'upstream_error' }    — network error or a non-200/404 from GCS
// Never throws — every branch is try/caught, matching this server's existing db_error-style handlers.
async function fetchReportMarkdown({ slug, env = process.env, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!isValidSlug(slug)) return { ok: false, status: 400, reason: 'invalid_slug' };
  const url = buildObjectUrl({ slug, env });
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return { ok: false, status: 404, reason: 'not_found' };
    if (!res.ok) return { ok: false, status: 502, reason: 'upstream_error' };
    const text = await res.text();
    return { ok: true, text };
  } catch (err) {
    return { ok: false, status: 502, reason: 'upstream_error' };
  }
}

// Fetches + parses the live JSON payload at live/<key>.json. Returns one of:
//   { ok: true, data }
//   { ok: false, status: 400, reason: 'invalid_key' }
//   { ok: false, status: 404, reason: 'not_found' }        — nothing has been published at this key yet
//   { ok: false, status: 502, reason: 'upstream_error' }    — network error or a non-200/404 from GCS
//   { ok: false, status: 502, reason: 'invalid_json' }      — the object exists but isn't parseable JSON
//                                                              (a publish mid-write, or a wrong content
//                                                              type — never expected in steady state)
// Never throws — same soft-mode contract as fetchReportMarkdown. A caller (the /api/live/:key route)
// turns any non-ok result into a 4xx/5xx JSON error; the CLIENT (public/reports.js) is the one that
// actually degrades gracefully, falling back to the bundled build-time snapshot on ANY failure here —
// this function's job is just "report what happened," not decide the fallback.
async function fetchLiveJson({ key, env = process.env, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!isValidLiveKey(key)) return { ok: false, status: 400, reason: 'invalid_key' };
  const url = buildLiveObjectUrl({ key, env });
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return { ok: false, status: 404, reason: 'not_found' };
    if (!res.ok) return { ok: false, status: 502, reason: 'upstream_error' };
    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch (_err) {
      return { ok: false, status: 502, reason: 'invalid_json' };
    }
  } catch (err) {
    return { ok: false, status: 502, reason: 'upstream_error' };
  }
}

module.exports = {
  DEFAULT_BUCKET,
  DEFAULT_STORAGE_BASE_URL,
  isValidSlug,
  isValidLiveKey,
  objectPathForSlug,
  liveObjectPath,
  resolveBucket,
  resolveStorageBaseUrl,
  buildObjectUrl,
  buildLiveObjectUrl,
  fetchReportMarkdown,
  fetchLiveJson,
};
