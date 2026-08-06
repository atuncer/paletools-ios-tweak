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

### Version stamping

`PALETOOLS_VERSION` defaults to `latest`, so **re-running the workflow picks up a
new PaleTools with no code change** — no commit needed to ship a fresh build.

Artifacts are never labelled `latest`. CI resolves it to a concrete version once,
up front, then:

1. stamps that version into `control`, so the `.deb` is named
   `com.paletools.eafc.injector_<version>_iphoneos-arm64.deb`,
2. names the workflow artifact `paletools-binaries-<version>`,
3. titles a tagged release `PaleTools <version>`,
4. passes the same version back into `make`, so the build never re-resolves
   `latest` and can't embed a different bundle than the one just stamped.

## Updating PaleTools

With `PALETOOLS_VERSION = latest` (the default) there is nothing to update — just
re-run the workflow, or `make clean && make package` locally.

To pin instead, set `PALETOOLS_VERSION` to an explicit version in `Makefile` (or
`make package PALETOOLS_VERSION=x.y.z`). Pin anything you need to reproduce later:
`latest` means the same commit can embed a different bundle tomorrow.

There is no `dist/latest/mobile/paletools-mobile.prod.js` (that path 404s), so
`latest` is resolved in two steps: `@version` is read from the header of
`dist/latest/paletools-mobile.user.js`, then that exact version is fetched. The
resolved version is always printed during the build. `fetch-mobile-prod.mjs
--resolve <version|latest>` prints just the resolved version, downloading nothing;
that is what CI uses for stamping.

The decode step extracts whatever blob the response contains regardless of version
key, so a normal version bump needs no other changes. If the build prints
`could not find paletools blob`, PaleTools changed its file format and the decode step
in `build-inject.sh` needs updating.

To refresh the offline fallback, run `node fetch-mobile-prod.mjs <version> >
paletools-mobile.prod.js` and commit the result.

## Verifying injection

On launch, look for `[PaleTools] injected WKUserScript into WKWebView` in the device
log (`idevicesyslog` / Console.app), and PaleTools' own UI inside the app. If the log
line never appears, confirm the app's bundle id matches `PaleTools.plist`.
