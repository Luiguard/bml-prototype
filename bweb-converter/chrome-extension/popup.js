// Tab Navigation
const tabs = ['Inspector', 'Cookies', 'Ads'];
tabs.forEach(tab => {
    document.getElementById(`tabBtn${tab}`).addEventListener('click', () => {
        tabs.forEach(t => {
            document.getElementById(`tabBtn${t}`).classList.remove('active');
            document.getElementById(`tab${t}`).classList.remove('active');
        });
        document.getElementById(`tabBtn${tab}`).classList.add('active');
        document.getElementById(`tab${tab}`).classList.add('active');
    });
});

// Inspector logic
async function checkCurrentTab() {
    try {
        const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        
        const isBwebPage = tab.url && (tab.url.endsWith('.bweb') || tab.url.includes('/bweb-converter/'));
        const activeEl = document.getElementById('statBwebActive');
        const sizeEl = document.getElementById('statPageSize');
        
        if (isBwebPage) {
            activeEl.textContent = 'Ja';
            activeEl.style.color = '#10b981';
            sizeEl.textContent = 'Kompiliert (BWEB)';
        } else {
            activeEl.textContent = 'Nein';
            activeEl.style.color = '#ef4444';
            sizeEl.textContent = 'Standard HTML';
        }
    } catch (e) {
        console.error("Error inspecting tab:", e);
    }
}

const brw = globalThis.browser || globalThis.chrome;

document.getElementById('btnInspectCurrent').addEventListener('click', async () => {
    const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
        // Redirect to our production converter with the tab URL as target to convert
        const converterUrl = 'https://mediclean-pro.at/bweb-converter/converter.html?source=' + encodeURIComponent(tab.url);
        brw.tabs.create({ url: converterUrl });
    }
});

// Run on popup open
checkCurrentTab();
