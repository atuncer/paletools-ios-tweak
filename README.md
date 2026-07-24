# PaleTools EAFC Injector

A self-contained iOS tweak that injects [PaleTools](https://pale.tools) into the
EA SPORTS FC Companion app. It hooks `WKWebView` and adds the PaleTools bundle as a
`WKUserScript`, so the app's own `www` bundle is never modified.

Works as a jailbreak tweak (Substrate / ElleKit) **or** as a dylib injected into a
sideloaded IPA via **Sideloadly** / **Feather** / **TrollFools** — no jailbreak required.

## Layout

| Path | Authored? | Purpose |
|------|-----------|---------|
| `Tweak.x` | yes | `WKWebView` hook; inflates and injects the payload at document-end. |
| `Makefile` | yes | Theos build config (rootless by default). |
| `control` | yes | Package metadata. |
| `PaleTools.plist` | yes | Process filter — targets `com.ea.gp.fifaultimate`. |
| `build-inject.sh` | yes | Fetches → decodes → wraps → gzips the PaleTools blob into `generated/`. |
| `fetch-mobile-prod.mjs` | yes | Pulls the pinned `PALETOOLS_VERSION` bundle from the pale.tools API. |
| `inject/export-settings.js` | yes | Adds the **Export Settings** button; appended to the bundle at build time. |
| `paletools-mobile.prod.js` | vendored | Offline fallback, only used if the API fetch fails. |
| `generated/` | no (gitignored) | Machine output: fetched bundle, `inject.js`, `pt_payload.gz`, `injectjs.h`. |

Nothing under `generated/` is hand-edited or committed; it is rebuilt on every `make`.

## Build

Requires [Theos](https://theos.dev) (`export THEOS=~/theos`).

```bash
make clean && make package
```

`before-all` runs `build-inject.sh` automatically, which fetches the `PALETOOLS_VERSION`
pinned in the `Makefile` from the pale.tools API and embeds it. If the fetch fails
(no network, pale.tools down), it falls back to the vendored `paletools-mobile.prod.js`.
Each `make package` writes **both** of these to `packages/`:

- `com.paletools.eafc.injector_*.deb` — the tweak package.
- `PaleTools.dylib` — the standalone fat dylib (arm64 + arm64e), the same signed bits
  that ship inside the `.deb`, extracted for direct injection.

Pick by install method:

- **Rootless jailbreak** (default): install the `.deb` with Sileo/Zebra.
- **Rootful jailbreak**: comment out `THEOS_PACKAGE_SCHEME = rootless` in `Makefile`
  and change `Depends: ellekit` → `Depends: mobilesubstrate` in `control`.
- **No jailbreak**: inject `packages/PaleTools.dylib` into the EA IPA with
  Sideloadly / Feather / TrollFools (they bundle the Substrate shim automatically).

## Releases (CI)

`.github/workflows/release.yml` builds on a macOS runner (uses Xcode's iOS SDK, no
toolchain setup needed). Push a tag to cut a release:

```bash
git tag v26.0.28 && git push origin v26.0.28
```

That builds with `FINALPACKAGE=1` and attaches both the `.deb` and `PaleTools.dylib`
to the GitHub Release. Manual `workflow_dispatch` runs build the same binaries and
upload them as workflow artifacts (no release).

## Updating PaleTools

1. Bump `PALETOOLS_VERSION` in `Makefile`.
2. `make clean && make package` — `build-inject.sh` fetches that version from
   `https://pale.tools/fifa/dist/<version>/mobile/paletools-mobile.prod.js`.

The decode step extracts whatever blob the response contains regardless of version
key, so a normal version bump needs no other changes. If the build prints
`could not find paletools blob`, PaleTools changed its file format and the decode step
in `build-inject.sh` needs updating.

To refresh the offline fallback, run `node fetch-mobile-prod.mjs <version> >
paletools-mobile.prod.js` and commit the result.

## Exporting your settings

PaleTools settings live entirely in `localStorage`:

- `paletools:settings` — base64 of `JSON.stringify(settings)`.
- `paletools:<APP_YEAR>:<userId>:<key>` — one plain-JSON entry per plugin.
- A few values are written to `sessionStorage` instead.

PaleTools' own Backup screen can't be used on iPhone: the button that opens it is
wrapped in `if (!isPhone())`, and its download uses `<a download>` + a `blob:` URL,
which WKWebView ignores. So `inject/export-settings.js` adds an **Export Settings**
button to the `.top-commands` bar at the top of the PaleTools settings screen,
next to *Reset Settings*.

Tapping it dumps **all** of `localStorage` and `sessionStorage` (raw, so the file
stays re-importable) plus a decoded copy of `paletools:settings` for readability,
then posts it to the tweak over the `paletoolsExport` script message handler.
`Tweak.x` writes the JSON to a temp file and opens the iOS share sheet, so you can
*Save to Files*, AirDrop or mail it. Outside a WKWebView the script falls back to a
normal anchor download.

## Verifying injection

On launch, look for `[PaleTools] injected WKUserScript into WKWebView` in the device
log (`idevicesyslog` / Console.app), and PaleTools' own UI inside the app. If the log
line never appears, confirm the app's bundle id matches `PaleTools.plist`.
