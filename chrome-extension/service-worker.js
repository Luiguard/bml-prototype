try { importScripts('updater.js'); } catch (e) { console.log(e); }
const brw = globalThis.browser || globalThis.chrome;

brw.runtime.onInstalled.addListener(() => {
    console.log("BWEB Inspector & Privacy Companion Extension installed successfully.");
});
