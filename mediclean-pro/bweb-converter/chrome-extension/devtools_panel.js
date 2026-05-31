// Panel UI Logic for BWEB Inspector
const brw = globalThis.browser || globalThis.chrome;

function updateTree(treeData) {
    const treeEl = document.getElementById('tree');
    treeEl.innerHTML = '<i>Warte auf BWEB-Daten aus dem aktiven Tab...</i>';
    // TODO: Connect via Chrome runtime messaging to the content script polyfill.js
    // to extract the live BDT and BLB arrays for inspection.
}

// Request data from active tab
brw.devtools.inspectedWindow.eval(
    "window.__BWEB_DEBUG_DATA__",
    function(result, isException) {
        if (!isException && result) {
            updateTree(result);
        } else {
            document.getElementById('tree').innerHTML = 'Kein BWEB im aktiven Tab gefunden.';
        }
    }
);

// Poll Performance Data
setInterval(() => {
    brw.devtools.inspectedWindow.eval(
        "window.__BWEB_PERF__",
        function(perf, isException) {
            if (!isException && perf) {
                document.getElementById('perf-info').innerText = 
                    `Layout Time: ${perf.layoutTime.toFixed(2)} ms (${perf.layoutNodes} nodes)\n` +
                    `Render Time: ${perf.renderTime.toFixed(2)} ms (${perf.renderedNodes} nodes drawn)\n` +
                    `Total Frame: ${(perf.layoutTime + perf.renderTime).toFixed(2)} ms`;
            }
        }
    );
}, 1000);
