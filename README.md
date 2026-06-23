# PaleTools EAFC Injector

A self-contained iOS tweak that injects [PaleTools](https://paletools.app/) into the
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
| `build-inject.sh` | yes | Decodes → wraps → gzips the PaleTools blob into `generated/`. |
| `paletools-mobile.prod.js` | vendored | The PaleTools payload. **Replace this to update versions.** |
| `generated/` | no (gitignored) | Machine output: `inject.js`, `pt_payload.gz`, `injectjs.h`. |

Nothing under `generated/` is hand-edited or committed; it is rebuilt on every `make`.

## Build

Requires [Theos](https://theos.dev) (`export THEOS=~/theos`).

```bash
make clean && make package
```

`before-all` runs `build-inject.sh` automatically, so the embedded payload is always
regenerated from `paletools-mobile.prod.js`. Output: `packages/*.deb`.

- **Rootless jailbreak** (default): install the `.deb` with Sileo/Zebra.
- **Rootful jailbreak**: comment out `THEOS_PACKAGE_SCHEME = rootless` in `Makefile`
  and change `Depends: ellekit` → `Depends: mobilesubstrate` in `control`.
- **No jailbreak**: run `make` to produce `.theos/obj/PaleTools.dylib` and inject it
  into the EA IPA with Sideloadly / Feather / TrollFools (they bundle the Substrate
  shim automatically).

## Updating PaleTools

1. Replace `paletools-mobile.prod.js` with the new version (same filename).
2. `make clean && make package`.

The build extracts whatever blob the file contains regardless of version key, so a
normal version bump needs no other changes. If the build prints
`could not find paletools blob`, PaleTools changed its file format and the decode step
in `build-inject.sh` needs updating.

## Verifying injection

On launch, look for `[PaleTools] injected WKUserScript into WKWebView` in the device
log (`idevicesyslog` / Console.app), and PaleTools' own UI inside the app. If the log
line never appears, confirm the app's bundle id matches `PaleTools.plist`.
