#!/usr/bin/env node
// Fetches a PaleTools mobile bundle from the pale.tools API.
//
// Usage:
//   node fetch-mobile-prod.mjs <version|latest>             bundle  -> stdout
//   node fetch-mobile-prod.mjs --resolve <version|latest>   version -> stdout
//
// There is no dist/latest/mobile/paletools-mobile.prod.js — that path 404s — so
// "latest" is resolved in two steps: read @version out of the latest userscript
// header, then fetch that exact version. The resolved version is always logged,
// so a build never hides which bundle it embedded.
//
// --resolve prints just the concrete version and downloads no bundle. CI uses it
// to stamp the package version and name the release artifacts, then passes that
// version back in, so the metadata can never say "latest" or drift from the
// bundle that actually got embedded.
//
// Called by build-inject.sh, which falls back to the vendored
// paletools-mobile.prod.js if this fails (offline build / pale.tools down).
const BASE = "https://pale.tools/fifa";

const args = process.argv.slice(2);
const resolveOnly = args[0] === "--resolve";
const requested = resolveOnly ? args[1] : args[0];

if (!requested) {
  console.error("usage: fetch-mobile-prod.mjs [--resolve] <version|latest>");
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

  if (resolveOnly) {
    if (requested === "latest") console.error(`latest resolves to ${version}`);
    process.stdout.write(version); // bare version, for CI to capture
  } else {
    if (requested === "latest") console.error(`latest resolves to ${version}`);
    const url = `${BASE}/dist/${version}/mobile/paletools-mobile.prod.js`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const code = await res.text();
    console.error(`fetched ${url} (${code.length} bytes)`);
    process.stdout.write(code);
  }
} catch (err) {
  console.error(`fetch failed: ${err.message}`);
  process.exit(1);
}
