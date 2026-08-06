#!/usr/bin/env node
// Fetches a PaleTools mobile bundle from the pale.tools API.
// Usage: node fetch-mobile-prod.mjs <version|latest>   (bundle -> stdout)
//
// There is no dist/latest/mobile/paletools-mobile.prod.js — that path 404s — so
// "latest" is resolved in two steps: read @version out of the latest userscript
// header, then fetch that exact version. The resolved version is always logged,
// so a build never hides which bundle it embedded.
//
// Called by build-inject.sh, which falls back to the vendored
// paletools-mobile.prod.js if this fails (offline build / pale.tools down).
const BASE = "https://pale.tools/fifa";

const requested = process.argv[2];
if (!requested) {
  console.error("usage: fetch-mobile-prod.mjs <version|latest>");
  process.exit(1);
}

async function resolveLatest() {
  const url = `${BASE}/dist/latest/paletools-mobile.user.js`;
  // Only the header is needed; 206 when the range is honoured, 200 if not.
  const res = await fetch(url, { headers: { Range: "bytes=0-400" } });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} (${url})`);
  const m = (await res.text()).match(/@version\s+([\d.]+)/);
  if (!m) throw new Error(`@version not found in ${url}`);
  return m[1];
}

try {
  const version = requested === "latest" ? await resolveLatest() : requested;
  if (requested === "latest") console.error(`latest resolves to ${version}`);

  const url = `${BASE}/dist/${version}/mobile/paletools-mobile.prod.js`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const code = await res.text();
  console.error(`fetched ${url} (${code.length} bytes)`);
  process.stdout.write(code);
} catch (err) {
  console.error(`fetch failed: ${err.message}`);
  process.exit(1);
}
