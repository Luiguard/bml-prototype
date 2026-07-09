// ══════════════════════════════════════════════
//  ConvertAny — Main Application Script
// ══════════════════════════════════════════════

// ── Utility Helpers ──
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function getFileCategory(ext) {
    const cats = {
        doc: ['docx','doc','odt','pdf','txt','rtf','pptx','ppt','xlsx','xls','csv','html'],
        img: ['jpg','jpeg','png','webp','gif','svg','tiff','tif','bmp','ico'],
        vid: ['mp4','webm','mkv','mov','avi','flv','wmv'],
        aud: ['mp3','wav','flac','ogg','m4a','aac','wma']
    };
    for (const [cat, exts] of Object.entries(cats)) {
        if (exts.includes(ext)) return cat;
    }
    return 'other';
}

function getCategoryLabel(cat) {
    return { doc: 'DOK', img: 'IMG', vid: 'VID', aud: 'AUD', other: 'DAT' }[cat] || 'DAT';
}

function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ── Format Map ──
const FORMAT_MAP = {
    docx: ['pdf','odt','txt','html','rtf'],
    doc: ['pdf','docx','odt','txt','rtf'],
    odt: ['pdf','docx','txt','rtf','html'],
    pdf: ['docx','odt','txt','html'],
    txt: ['pdf','docx','odt','html'],
    rtf: ['pdf','docx','odt','txt'],
    pptx: ['pdf','ppt','odp'],
    ppt: ['pdf','pptx','odp'],
    xlsx: ['pdf','xls','ods','csv'],
    xls: ['pdf','xlsx','ods','csv'],
    csv: ['xlsx','pdf','ods'],
    mp4: ['webm','mkv','avi','mov','mp3','wav','flac'],
    webm: ['mp4','mkv','mov','mp3','wav'],
    mkv: ['mp4','webm','mov','mp3'],
    mov: ['mp4','webm','mkv','mp3'],
    avi: ['mp4','webm','mp3'],
    mp3: ['wav','flac','ogg','m4a'],
    wav: ['mp3','flac','ogg'],
    flac: ['mp3','wav','ogg'],
    ogg: ['mp3','wav','flac'],
    jpg: ['png','webp','pdf','gif','tiff','bmp'],
    jpeg: ['png','webp','pdf','gif','tiff','bmp'],
    png: ['jpg','webp','pdf','gif','tiff','bmp'],
    webp: ['jpg','png','pdf','gif'],
    gif: ['mp4','webp','png','jpg'],
    svg: ['png','jpg','pdf'],
    tiff: ['jpg','png','webp','pdf'],
    tif: ['jpg','png','webp','pdf'],
    bmp: ['jpg','png','webp','pdf']
};

// ── Persistent Stats ──
const stats = JSON.parse(localStorage.getItem('convertany_stats') || '{"converted":0,"bytes":0}');
function updateStatsUI() {
    const el = document.getElementById('stat-converted');
    const el2 = document.getElementById('stat-saved');
    if (el) el.textContent = stats.converted;
    if (el2) el2.textContent = formatBytes(stats.bytes);
}
function bumpStats(fileSize) {
    stats.converted++;
    stats.bytes += fileSize;
    localStorage.setItem('convertany_stats', JSON.stringify(stats));
    updateStatsUI();
}
updateStatsUI();

// ── Conversion History ──
function getHistory() { return JSON.parse(localStorage.getItem('convertany_history') || '[]'); }
function saveHistory(entry) {
    const h = getHistory();
    h.unshift(entry);
    if (h.length > 30) h.length = 30;
    localStorage.setItem('convertany_history', JSON.stringify(h));
    renderHistory();
}
function renderHistory() {
    const list = document.getElementById('history-list');
    const h = getHistory();
    if (!h.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Noch keine Konvertierungen.</p>'; return; }
    list.innerHTML = h.map(e => `
        <div class="history-item">
            <span style="font-size:0.85rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.name}</span>
            <span class="arrow">→</span>
            <span style="font-size:0.8rem;font-weight:600;color:var(--accent-primary)">${e.format.toUpperCase()}</span>
            <span style="font-size:0.7rem;color:var(--text-muted)">${e.time}</span>
        </div>
    `).join('');
}
document.getElementById('history-toggle-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('history-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    renderHistory();
});
document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    localStorage.removeItem('convertany_history');
    renderHistory();
    toast('Verlauf gelöscht', 'info');
});

// ── Tab System ──
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
        lucide.createIcons();
    });
});

// ── Image Tool Mode Tabs ──
document.querySelectorAll('[data-imgmode]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-imgmode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.imgmode;
        document.getElementById('options-img-convert').style.display = mode === 'convert' ? 'block' : 'none';
        document.getElementById('options-img-compress').style.display = mode === 'compress' ? 'block' : 'none';
        document.getElementById('options-img-resize').style.display = mode === 'resize' ? 'block' : 'none';
        validateImageForm();
    });
});

// ── Clear All ──
document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    mainFiles = [];
    imgFiles = [];
    careerFile = null;
    renderFileQueue('file-queue-main', mainFiles);
    renderFileQueue('file-queue-img', imgFiles);
    renderFileQueue('file-queue-career', careerFile ? [careerFile] : []);
    renderFileQueue('file-queue-translator', translatorFile ? [translatorFile] : []);
    document.getElementById('options-main').classList.remove('visible');
    document.getElementById('file-analysis-main').classList.remove('visible');
    document.getElementById('download-area-main').style.display = 'none';
    document.getElementById('download-area-img').style.display = 'none';
    document.getElementById('download-area-career').style.display = 'none';
    document.getElementById('download-area-translator').style.display = 'none';
    document.getElementById('convert-btn-main').disabled = true;
    document.getElementById('img-action-btn').disabled = true;
    document.getElementById('career-btn').disabled = true;
    document.getElementById('translate-btn').disabled = true;
    toast('Alles zurückgesetzt', 'info');
});

// ══════════════════════════════════════════════
//  MAIN CONVERTER
// ══════════════════════════════════════════════
let mainFiles = [];

function setupDropZone(dropId, inputId, onFiles) {
    const dz = document.getElementById(dropId);
    const inp = document.getElementById(inputId);
    if (!dz || !inp) return;

    dz.addEventListener('click', () => inp.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag-over');
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
    });
    inp.addEventListener('change', e => {
        if (e.target.files.length) onFiles(Array.from(e.target.files));
        inp.value = '';
    });
}

function renderFileQueue(containerId, files) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!files.length) { container.innerHTML = ''; return; }

    container.innerHTML = files.map((f, i) => {
        const ext = f.name.split('.').pop().toLowerCase();
        const cat = getFileCategory(ext);
        const statusClass = f._status || 'pending';
        const statusLabel = { pending: 'Bereit', converting: 'Konvertiert...', done: 'Fertig', error: 'Fehler' }[statusClass] || 'Bereit';
        return `
            <div class="file-item ${statusClass}" data-idx="${i}">
                <div class="file-item-icon ${cat}">${getCategoryLabel(cat)}</div>
                <div class="file-item-info">
                    <div class="file-item-name">${f.name}</div>
                    <div class="file-item-meta">${formatBytes(f.size)} · ${ext.toUpperCase()}</div>
                    <div class="file-item-progress"><div class="file-item-progress-fill" style="width:${f._progress || 0}%"></div></div>
                </div>
                <span class="file-item-status ${statusClass}">${statusLabel}</span>
                <button class="file-item-remove" onclick="removeFile('${containerId}', ${i})" title="Entfernen">
                    <i data-lucide="x" style="width:16px;height:16px"></i>
                </button>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

window.removeFile = function(containerId, idx) {
    if (containerId === 'file-queue-main') {
        mainFiles.splice(idx, 1);
        renderFileQueue('file-queue-main', mainFiles);
        if (!mainFiles.length) {
            document.getElementById('options-main').classList.remove('visible');
            document.getElementById('file-analysis-main').classList.remove('visible');
        }
        validateMainForm();
    } else if (containerId === 'file-queue-img') {
        imgFiles.splice(idx, 1);
        renderFileQueue('file-queue-img', imgFiles);
        validateImageForm();
    } else if (containerId === 'file-queue-career') {
        careerFile = null;
        renderFileQueue('file-queue-career', []);
        document.getElementById('options-career').classList.remove('visible');
        validateCareerForm();
    } else if (containerId === 'file-queue-translator') {
        translatorFile = null;
        renderFileQueue('file-queue-translator', []);
        document.getElementById('translate-btn').disabled = true;
    }
};

// Main drop zone
setupDropZone('drop-zone-main', 'file-input-main', (files) => {
    mainFiles = mainFiles.concat(files);
    renderFileQueue('file-queue-main', mainFiles);

    // Populate format selector based on first file
    if (mainFiles.length) {
        const ext = mainFiles[0].name.split('.').pop().toLowerCase();
        populateFormats('output-format-main', ext);
        document.getElementById('options-main').classList.add('visible');
        showAnalysis(mainFiles[0]);

        // Show quality options for media files
        const cat = getFileCategory(ext);
        document.getElementById('quality-group-main').style.display = (cat === 'vid' || cat === 'aud') ? 'block' : 'none';
    }
    validateMainForm();
    toast(`${files.length} Datei(en) hinzugefügt`, 'success');
});

function populateFormats(selectId, ext) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">Wähle Format...</option>';
    const suggestions = FORMAT_MAP[ext] || [];

    if (suggestions.length) {
        const grp = document.createElement('optgroup');
        grp.label = 'Empfohlene Formate';
        suggestions.forEach(fmt => {
            const opt = document.createElement('option');
            opt.value = fmt; opt.textContent = fmt.toUpperCase();
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    }
}

function showAnalysis(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const cat = getFileCategory(ext);
    const grid = document.getElementById('analysis-grid-main');
    const panel = document.getElementById('file-analysis-main');

    let items = [
        { label: 'Dateiname', value: file.name },
        { label: 'Größe', value: formatBytes(file.size) },
        { label: 'Typ', value: file.type || ext.toUpperCase() },
        { label: 'Kategorie', value: { doc:'Dokument', img:'Bild', vid:'Video', aud:'Audio', other:'Sonstige' }[cat] }
    ];

    if (cat === 'img') {
        items.push({ label: 'Vorschau', value: '(Wird geladen...)' });
        // Try to read image dimensions
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const dimEl = document.querySelector('#analysis-grid-main .analysis-item:last-child .value');
            if (dimEl) dimEl.textContent = `${img.width} × ${img.height} px`;
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    if (file.lastModified) {
        items.push({ label: 'Geändert', value: new Date(file.lastModified).toLocaleDateString('de-DE') });
    }

    grid.innerHTML = items.map(it => `
        <div class="analysis-item">
            <div class="label">${it.label}</div>
            <div class="value">${it.value}</div>
        </div>
    `).join('');
    panel.classList.add('visible');
}

function validateMainForm() {
    const btn = document.getElementById('convert-btn-main');
    const fmt = document.getElementById('output-format-main').value;
    btn.disabled = !(mainFiles.length && fmt);
}

document.getElementById('output-format-main')?.addEventListener('change', validateMainForm);

// ── Main Convert Action ──
document.getElementById('convert-btn-main')?.addEventListener('click', async () => {
    const format = document.getElementById('output-format-main').value;
    const quality = document.getElementById('quality-main').value;
    if (!mainFiles.length || !format) return;

    const btn = document.getElementById('convert-btn-main');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin" style="width:18px;height:18px"></i> Konvertiert...';
    lucide.createIcons();

    document.getElementById('download-area-main').style.display = 'none';

    // Process files sequentially
    for (let i = 0; i < mainFiles.length; i++) {
        const file = mainFiles[i];
        file._status = 'converting';
        file._progress = 20;
        renderFileQueue('file-queue-main', mainFiles);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        if (quality !== 'original') formData.append('quality', quality);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                if (file._progress < 85) {
                    file._progress += Math.random() * 10;
                    renderFileQueue('file-queue-main', mainFiles);
                }
            }, 400);

            const response = await fetch('convert', { method: 'POST', body: formData });

            clearInterval(progressInterval);

            if (response.ok) {
                file._status = 'done';
                file._progress = 100;
                renderFileQueue('file-queue-main', mainFiles);

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

                const dlLink = document.getElementById('download-link-main');
                dlLink.href = url;
                dlLink.download = `${baseName}.${format}`;
                document.getElementById('download-area-main').style.display = 'block';

                bumpStats(file.size);
                saveHistory({
                    name: file.name,
                    format: format,
                    size: file.size,
                    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                });

                toast(`${file.name} konvertiert!`, 'success');
            } else {
                throw new Error('Server-Fehler');
            }
        } catch (err) {
            file._status = 'error';
            file._progress = 100;
            renderFileQueue('file-queue-main', mainFiles);
            toast(`Fehler bei ${file.name}: ${err.message}`, 'error');
        }
    }

    btn.innerHTML = '<i data-lucide="zap" style="width:18px;height:18px"></i> Jetzt konvertieren';
    btn.disabled = false;
    lucide.createIcons();
});


// ══════════════════════════════════════════════
//  IMAGE TOOLS
// ══════════════════════════════════════════════
let imgFiles = [];

setupDropZone('drop-zone-img', 'file-input-img', (files) => {
    imgFiles = imgFiles.concat(files);
    renderFileQueue('file-queue-img', imgFiles);
    // Show relevant options panel
    const activeMode = document.querySelector('[data-imgmode].active')?.dataset.imgmode || 'convert';
    document.getElementById('options-img-convert').style.display = activeMode === 'convert' ? 'block' : 'none';
    document.getElementById('options-img-compress').style.display = activeMode === 'compress' ? 'block' : 'none';
    document.getElementById('options-img-resize').style.display = activeMode === 'resize' ? 'block' : 'none';
    validateImageForm();
    toast(`${files.length} Bild(er) hinzugefügt`, 'success');
});

// Quality slider display
document.getElementById('img-quality')?.addEventListener('input', (e) => {
    document.getElementById('img-quality-value').textContent = e.target.value + '%';
});

// Resize preset handling
document.getElementById('img-resize-preset')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const widthInput = document.getElementById('img-width');
    const heightInput = document.getElementById('img-height');
    if (val !== 'custom') {
        const [w, h] = val.split('x');
        widthInput.value = w;
        heightInput.value = h;
    } else {
        widthInput.value = '';
        heightInput.value = '';
    }
    validateImageForm();
});

function getActiveImageMode() {
    return document.querySelector('[data-imgmode].active')?.dataset.imgmode || 'convert';
}

function validateImageForm() {
    const btn = document.getElementById('img-action-btn');
    if (!imgFiles.length) { btn.disabled = true; return; }
    const mode = getActiveImageMode();
    if (mode === 'convert') {
        btn.disabled = !document.getElementById('img-target-format').value;
    } else if (mode === 'compress') {
        btn.disabled = false;
    } else if (mode === 'resize') {
        const w = document.getElementById('img-width').value;
        const h = document.getElementById('img-height').value;
        btn.disabled = !(w || h);
    }
}

document.getElementById('img-target-format')?.addEventListener('change', validateImageForm);
document.getElementById('img-width')?.addEventListener('input', validateImageForm);
document.getElementById('img-height')?.addEventListener('input', validateImageForm);

// ── Image Action ──
document.getElementById('img-action-btn')?.addEventListener('click', async () => {
    if (!imgFiles.length) return;
    const mode = getActiveImageMode();
    const btn = document.getElementById('img-action-btn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin" style="width:18px;height:18px"></i> Verarbeite...';
    lucide.createIcons();

    document.getElementById('download-area-img').style.display = 'none';

    for (let i = 0; i < imgFiles.length; i++) {
        const file = imgFiles[i];
        file._status = 'converting';
        file._progress = 30;
        renderFileQueue('file-queue-img', imgFiles);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', mode);

        let endpoint = 'convert';
        if (mode === 'convert') {
            formData.append('format', document.getElementById('img-target-format').value);
        } else if (mode === 'compress') {
            formData.append('format', file.name.split('.').pop().toLowerCase());
            formData.append('quality', document.getElementById('img-quality').value);
            endpoint = 'compress';
        } else if (mode === 'resize') {
            formData.append('format', file.name.split('.').pop().toLowerCase());
            formData.append('width', document.getElementById('img-width').value || '0');
            formData.append('height', document.getElementById('img-height').value || '0');
            endpoint = 'resize';
        }

        try {
            const progressInterval = setInterval(() => {
                if (file._progress < 85) {
                    file._progress += Math.random() * 15;
                    renderFileQueue('file-queue-img', imgFiles);
                }
            }, 300);

            const response = await fetch(endpoint, { method: 'POST', body: formData });
            clearInterval(progressInterval);

            if (response.ok) {
                file._status = 'done';
                file._progress = 100;
                renderFileQueue('file-queue-img', imgFiles);

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const ext = mode === 'convert' ? document.getElementById('img-target-format').value : file.name.split('.').pop().toLowerCase();

                const dlLink = document.getElementById('download-link-img');
                dlLink.href = url;
                dlLink.download = `${baseName}${mode === 'compress' ? '_compressed' : mode === 'resize' ? '_resized' : ''}.${ext}`;
                document.getElementById('download-area-img').style.display = 'block';

                bumpStats(file.size);
                saveHistory({
                    name: file.name,
                    format: mode === 'convert' ? ext : mode,
                    size: file.size,
                    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                });

                toast(`${file.name} verarbeitet!`, 'success');
            } else {
                throw new Error('Server-Fehler');
            }
        } catch (err) {
            file._status = 'error';
            file._progress = 100;
            renderFileQueue('file-queue-img', imgFiles);
            toast(`Fehler bei ${file.name}: ${err.message}`, 'error');
        }
    }

    btn.innerHTML = '<i data-lucide="wand-2" style="width:18px;height:18px"></i> Bilder verarbeiten';
    btn.disabled = false;
    lucide.createIcons();
});




// ══════════════════════════════════════════════
//  PDF TRANSLATOR
// ══════════════════════════════════════════════
let translatorFile = null;

setupDropZone('drop-zone-translator', 'file-input-translator', (files) => {
    translatorFile = files[0];
    renderFileQueue('file-queue-translator', [translatorFile]);
    document.getElementById('translate-btn').disabled = false;
    toast('PDF geladen', 'success');
});

document.getElementById('translate-btn')?.addEventListener('click', async () => {
    if (!translatorFile) return;

    const btn = document.getElementById('translate-btn');
    const loadingUI = document.getElementById('translator-loading');
    
    btn.disabled = true;
    btn.style.display = 'none';
    loadingUI.style.display = 'block';

    document.getElementById('download-area-translator').style.display = 'none';

    translatorFile._status = 'converting';
    translatorFile._progress = 10;
    renderFileQueue('file-queue-translator', [translatorFile]);

    const jobId = Math.random().toString(36).substring(2, 15);
    const formData = new FormData();
    formData.append('file', translatorFile);
    formData.append('source_lang', document.getElementById('lang-source').value);
    formData.append('target_lang', document.getElementById('lang-target').value);
    formData.append('job_id', jobId);

    const statusTextEl = document.querySelector('#translator-loading p');
    if (statusTextEl) statusTextEl.innerText = "Sende Datei an Server...";

    try {
        const response = await fetch('translate-pdf', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Start der Übersetzung fehlgeschlagen');

        let isDone = false;
        let isError = false;
        let lastError = '';

        const progressInterval = setInterval(async () => {
            if (translatorFile._progress < 90) {
                translatorFile._progress += Math.random() * 2;
                renderFileQueue('file-queue-translator', [translatorFile]);
            }
            try {
                const statusRes = await fetch(`translate-status?job_id=${jobId}`);
                const statusData = await statusRes.json();
                if (statusData.success && statusData.status && statusTextEl) {
                    statusTextEl.innerText = statusData.status;
                    if (statusData.status.includes("Abgeschlossen!")) {
                        isDone = true;
                    } else if (statusData.status.toLowerCase().includes("fehler")) {
                        isError = true;
                        lastError = statusData.status;
                    }
                }
            } catch (e) {}
        }, 1500);

        // Wait until done or error
        while (!isDone && !isError) {
            await new Promise(r => setTimeout(r, 1000));
        }
        clearInterval(progressInterval);

        if (isError) throw new Error(lastError || 'Übersetzungsfehler');

        translatorFile._status = 'done';
        translatorFile._progress = 100;
        renderFileQueue('file-queue-translator', [translatorFile]);

        const dlUrl = `download-pdf?job_id=${jobId}`;
        const baseName = translatorFile.name.substring(0, translatorFile.name.lastIndexOf('.')) || translatorFile.name;
        const tgtCode = document.getElementById('lang-target').value.toUpperCase();
        
        const dlLink = document.getElementById('download-link-translator');
        dlLink.href = dlUrl;
        dlLink.download = `${baseName}_${tgtCode}.pdf`;
        document.getElementById('download-area-translator').style.display = 'block';

        bumpStats(translatorFile.size);
        saveHistory({
            name: translatorFile.name,
            format: `pdf_${tgtCode}`,
            size: translatorFile.size,
            time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        });

        toast('PDF erfolgreich übersetzt!', 'success');
    } catch (err) {
        translatorFile._status = 'error';
        translatorFile._progress = 100;
        renderFileQueue('file-queue-translator', [translatorFile]);
        toast('Fehler: ' + err.message, 'error');
    }

    loadingUI.style.display = 'none';
    btn.style.display = 'flex';
    btn.innerHTML = '<i data-lucide="languages" style="width:18px;height:18px"></i> PDF übersetzen';
    btn.disabled = false;
    lucide.createIcons();
});
