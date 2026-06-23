(function () {
    "use strict";
    // Runs after paletools-mobile.prod.js (prepended at build time) has
    // populated window.paletools. Decodes each blob and evals it in page scope.
    function boot() {
        var store = window.paletools;
        if (!store) { console.error("[paletools-loader] window.paletools missing"); return; }
        Object.keys(store).forEach(function (key) {
            var blob = store[key];
            if (typeof blob !== "string") return;
            try {
                var code = decodeURIComponent(blob);
                store[key] = { loaded: true };
                (0, eval)(code);
                console.log("[paletools-loader] loaded " + key);
            } catch (e) {
                console.error("[paletools-loader] failed " + key, e);
            }
        });
    }
    if (document.readyState === "complete") setTimeout(boot, 0);
    else window.addEventListener("load", function () { setTimeout(boot, 0); });
})();
