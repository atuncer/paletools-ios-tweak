/* Export Settings button — appended to the PaleTools bundle by build-inject.sh.
 *
 * Why this exists: PaleTools ships a Backup screen with export/import, but it is
 * gated behind `if (!isPhone())` so it never renders on iPhone, and its download
 * path is `<a download>` + `URL.createObjectURL(blob)`, which WKWebView silently
 * ignores. This adds a button that dumps storage and hands the JSON to the tweak
 * over a script message handler, which writes a file and opens the iOS share sheet.
 *
 * Settings live entirely in localStorage:
 *   paletools:settings                        -> btoa(JSON.stringify(settings))
 *   paletools:<APP_YEAR>:<userId>:<key>       -> JSON.stringify(value)
 * A few values are written to sessionStorage instead, so both are dumped raw.
 */
(function () {
    "use strict";

    var BTN_ID = "pt-export-storage-btn";
    var HANDLER = "paletoolsExport";

    function readStorage(store) {
        var out = {};
        if (!store) return out;
        for (var i = 0; i < store.length; i++) {
            var k = store.key(i);
            try {
                out[k] = store.getItem(k);
            } catch (e) {
                out[k] = null;
            }
        }
        return out;
    }

    // Convenience copy of the settings blob, decoded. The raw entry is kept in
    // localStorage as-is so the dump stays byte-faithful and re-importable.
    function decodedSettings(raw) {
        try {
            return JSON.parse(atob(raw));
        } catch (e) {
            return null;
        }
    }

    function buildPayload() {
        var ls = readStorage(window.localStorage);
        return {
            exportedAt: new Date().toISOString(),
            href: location.href,
            settingsDecoded: ls["paletools:settings"]
                ? decodedSettings(ls["paletools:settings"])
                : null,
            localStorage: ls,
            sessionStorage: readStorage(window.sessionStorage)
        };
    }

    function filename() {
        return "paletools-storage-" +
            new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    }

    function nativeHandler() {
        return window.webkit &&
            window.webkit.messageHandlers &&
            window.webkit.messageHandlers[HANDLER];
    }

    // Fallback for when the tweak's handler is absent (e.g. running in a normal
    // browser): the classic anchor download, which does work outside WKWebView.
    function browserDownload(name, json) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.setAttribute("download", name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function doExport(btn) {
        var label = btn.textContent;
        btn.textContent = "Exporting...";
        btn.disabled = true;
        try {
            var json = JSON.stringify(buildPayload(), null, 2);
            var name = filename();
            var h = nativeHandler();
            if (h) {
                h.postMessage({ filename: name, json: json });
            } else {
                browserDownload(name, json);
            }
            btn.textContent = "Exported";
        } catch (e) {
            btn.textContent = "Export failed";
            if (window.console) console.error("[PaleTools] export failed", e);
        }
        setTimeout(function () {
            btn.textContent = label;
            btn.disabled = false;
        }, 2000);
    }

    function makeButton(reference) {
        var b = document.createElement("button");
        b.id = BTN_ID;
        // Borrow the neighbouring button's look, minus `reset-settings` — that
        // class is a behavioural hook PaleTools queries for, not styling.
        b.className = (reference ? reference.className : "btn-standard mini")
            .split(/\s+/)
            .filter(function (c) { return c && c !== "reset-settings"; })
            .join(" ");
        b.textContent = "Export Settings";
        b.addEventListener("click", function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            doExport(b);
        });
        return b;
    }

    // The settings screen renders a `.top-commands` bar holding the Reset button
    // (and, on non-phones, Backup). Append next to them once it appears.
    function tryInject() {
        var bars = document.querySelectorAll(".top-commands");
        for (var i = 0; i < bars.length; i++) {
            var bar = bars[i];
            if (bar.querySelector("#" + BTN_ID)) continue;
            var ref = bar.querySelector(".reset-settings") || bar.querySelector("button");
            if (ref && ref.tagName !== "BUTTON") {
                ref = ref.querySelector("button") || ref;
            }
            bar.appendChild(makeButton(ref));
        }
    }

    function start() {
        tryInject();
        new MutationObserver(tryInject).observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
