/**
 * BPG Updater - Handles bwebfeed/manifest.bpg fetching and delta-patching
 */
const brw = globalThis.browser || globalThis.chrome;

async function checkBPGUpdates(urlStr) {
    try {
        const url = new URL(urlStr);
        const manifestUrl = `${url.origin}/manifest.bpg`;
        
        // Fetch the manifest (in a real scenario, this could be binary, here we assume JSON for simplicity)
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) return null;
        
        const manifest = await response.json();
        
        // Read local version
        const localData = await brw.storage.local.get(['bpg_version_' + url.origin]);
        const localVersion = localData['bpg_version_' + url.origin];
        
        if (localVersion !== manifest.version) {
            console.log(`[BPG Updater] Neue Version gefunden für ${url.origin}: ${manifest.version} (Lokal: ${localVersion || 'Keine'})`);
            
            // Check for delta patch
            const patchKey = `${localVersion}_to_${manifest.version}`;
            if (localVersion && manifest.delta_patches && manifest.delta_patches[patchKey]) {
                console.log(`[BPG Updater] Lade Delta-Patch: ${manifest.delta_patches[patchKey]}`);
                // TODO: Fetch patch and apply via bsdiff/bpatch algorithm on cached modules
            } else {
                console.log(`[BPG Updater] Lade vollständige Module...`);
                // TODO: Fetch changed modules based on checksums
            }
            
            // Update version locally
            await brw.storage.local.set({ ['bpg_version_' + url.origin]: manifest.version });
            
            // Apply Feature Flags
            if (manifest.feature_flags) {
                await brw.storage.local.set({ ['bpg_flags_' + url.origin]: manifest.feature_flags });
            }
            
            return manifest;
        }
        return null;
    } catch (e) {
        console.error("[BPG Updater] Update-Prüfung fehlgeschlagen:", e);
        return null;
    }
}

brw.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
        if (tab.url.endsWith('.bpg') || tab.url.endsWith('.bweb')) {
            checkBPGUpdates(tab.url);
        }
    }
});
