#!/usr/bin/env node
// Fetches a pinned PaleTools mobile bundle from the pale.tools API.
// Usage: node fetch-mobile-prod.mjs <version>  (writes the bundle to stdout)
// Called by build-inject.sh, which falls back to the vendored
// paletools-mobile.prod.js if this fails (offline build / pale.tools down).
const BASE = "https://pale.tools/fifa";

const version = process.argv[2];
if (!version) {
  console.error("usage: fetch-mobile-prod.mjs <version>");
  process.exit(1);
}

const url = `${BASE}/dist/${version}/mobile/paletools-mobile.prod.js`;

try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const code = await res.text();
  console.error(`fetched ${url} (${code.length} bytes)`);
  process.stdout.write(code);
} catch (err) {
  console.error(`fetch failed: ${err.message} (${url})`);
  process.exit(1);
}
