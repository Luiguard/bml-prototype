// Omnia Vault - App Logic (Server-Connected)

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Check if user is logged in
    const session = JSON.parse(sessionStorage.getItem('vault_session') || 'null');
    if (!session || !session.success) {
        window.location.href = 'login.html';
        return;
    }

    // Display user info
    const userName = document.querySelector('.user-name');
    if (userName) userName.textContent = session.displayName || 'Principal';

    // Export & Import Listeners
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-file');
    if (exportBtn) exportBtn.addEventListener('click', exportVault);
    if (importInput) importInput.addEventListener('change', importVault);

    // Functional Buttons
    const addAssetBtn = document.getElementById('add-asset-btn');
    if (addAssetBtn) addAssetBtn.addEventListener('click', addAsset);

    const createQrBtn = document.getElementById('create-qr-btn');
    if (createQrBtn) createQrBtn.addEventListener('click', () => {
        // Navigate to delegation view
        document.querySelectorAll('#sidebar-nav li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.vault-view').forEach(v => v.style.display = 'none');
        const delegationLi = document.querySelector('[data-target="view-delegation"]');
        if (delegationLi) delegationLi.classList.add('active');
        document.getElementById('view-delegation').style.display = 'block';
        loadDelegates();
    });

    const createHeirBtn = document.getElementById('create-heir-btn');
    if (createHeirBtn) createHeirBtn.addEventListener('click', createHeirLink);

    const headerLinkBtn = document.getElementById('header-link-btn');
    if (headerLinkBtn) {
        headerLinkBtn.addEventListener('click', () => {
            // Navigate to delegation view
            document.querySelectorAll('#sidebar-nav li').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.vault-view').forEach(v => v.style.display = 'none');
            const delegationLi = document.querySelector('[data-target="view-delegation"]');
            if (delegationLi) delegationLi.classList.add('active');
            document.getElementById('view-delegation').style.display = 'block';
            loadDelegates();
        });
    }

    const delegationViewQrBtn = document.getElementById('delegation-view-qr-btn');
    if (delegationViewQrBtn) delegationViewQrBtn.addEventListener('click', createDelegateLink);

    // Sidebar Navigation Logic
    const sidebarItems = document.querySelectorAll('#sidebar-nav li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarItems.forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.vault-view').forEach(view => view.style.display = 'none');
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) targetView.style.display = 'block';
                if (targetId === 'view-delegation') loadDelegates();
            }
        });
    });

    // Settings Button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarItems.forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.vault-view').forEach(view => view.style.display = 'none');
            const targetView = document.getElementById('view-settings');
            if (targetView) targetView.style.display = 'block';
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('vault_session');
            window.location.href = 'login.html';
        });
    }

    // Alerts / Bell Button
    const alertsBtn = document.getElementById('alerts-btn');
    const alertsDropdown = document.getElementById('alerts-dropdown');
    if (alertsBtn && alertsDropdown) {
        alertsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            alertsDropdown.style.display = alertsDropdown.style.display === 'none' ? 'block' : 'none';
            renderAlerts();
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!alertsDropdown.contains(e.target) && e.target !== alertsBtn) {
                alertsDropdown.style.display = 'none';
            }
        });
    }

    // Init local vault data and render
    initVault();
    initAlerts();
    updateDisplay();

    // Fetch pending items from server
    fetchPendingItems();
});


// --------------------------------------------------------
// SERVER SYNC - Fetch pending items from delegation
// --------------------------------------------------------

async function fetchPendingItems() {
    const session = JSON.parse(sessionStorage.getItem('vault_session'));
    if (!session) return;

    try {
        const res = await fetch(`/api/vault/pending?uid=${session.userId}`);
        const data = await res.json();

        if (data.success && data.count > 0) {
            // Merge into local vault
            const rawData = localStorage.getItem('omnia_data');
            let vaultData = rawData ? JSON.parse(rawData) : { net_worth: 0, assets: [] };

            data.items.forEach(item => {
                vaultData.assets.push({
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    value: item.value,
                    notes: item.notes
                });
                vaultData.net_worth += item.value;
                // Alert for each synced item
                addAlert('package', `New: ${item.name}`, `${item.type} — submitted by staff via delegation`, 'success');
            });

            localStorage.setItem('omnia_data', JSON.stringify(vaultData));
            updateDisplay();
            showSyncNotification(data.count);
        }
    } catch (e) {
        console.log('Sync check: offline or server unreachable');
    }
}

function showSyncNotification(count) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const syncInfo = document.createElement('span');
    syncInfo.className = 'text-emerald-400 text-xs mr-4 uppercase tracking-wider';
    syncInfo.innerHTML = `✓ ${count} new items synced`;
    headerActions.prepend(syncInfo);

    setTimeout(() => syncInfo.remove(), 8000);
}


// --------------------------------------------------------
// DELEGATION LINKS (Server-side tokens)
// --------------------------------------------------------

async function createDelegateLink() {
    const session = JSON.parse(sessionStorage.getItem('vault_session'));
    if (!session) return;

    const labelInput = document.getElementById('delegate-label');
    const label = labelInput ? labelInput.value.trim() : '';

    if (!label) {
        if (labelInput) labelInput.style.borderColor = 'rgba(224, 82, 82, 0.5)';
        setTimeout(() => { if (labelInput) labelInput.style.borderColor = ''; }, 2000);
        return;
    }

    try {
        const res = await fetch('/api/vault/delegate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId, label: label })
        });
        const data = await res.json();

        if (data.success) {
            const link = `${window.location.origin}/omnia-vault/delegate.html?token=${data.token}`;
            const linkBox = document.getElementById('generated-link-box');
            const linkUrl = document.getElementById('generated-link-url');
            if (linkBox && linkUrl) {
                linkUrl.value = link;
                linkBox.style.display = 'block';
            }
            if (labelInput) labelInput.value = '';
            loadDelegates();
        }
    } catch (e) {
        alert('Connection error. Please try again.');
    }
}

function copyLink() {
    const linkUrl = document.getElementById('generated-link-url');
    if (linkUrl) {
        linkUrl.select();
        navigator.clipboard.writeText(linkUrl.value);
        const copyBtn = linkUrl.parentElement.querySelector('button');
        if (copyBtn) {
            copyBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
            lucide.createIcons();
            setTimeout(() => {
                copyBtn.innerHTML = '<i data-lucide="copy"></i> Copy';
                lucide.createIcons();
            }, 2000);
        }
    }
}

async function loadDelegates() {
    const session = JSON.parse(sessionStorage.getItem('vault_session'));
    if (!session) return;

    const listEl = document.getElementById('delegates-list');
    if (!listEl) return;

    try {
        const res = await fetch(`/api/vault/delegates?uid=${session.userId}`);
        const data = await res.json();

        if (data.success && data.delegates.length > 0) {
            listEl.innerHTML = data.delegates.map(d => {
                const date = new Date(d.created_at * 1000).toLocaleDateString();
                const status = d.active ? '<span style="color: #10b981;">● Active</span>' : '<span style="color: #666;">● Revoked</span>';
                const revokeBtn = d.active ? `<button class="secondary-btn" onclick="revokeDelegate('${d.token}')" style="padding: 4px 10px; font-size: 0.7rem; color: var(--danger); border-color: var(--danger);"><i data-lucide="x"></i> Revoke</button>` : '';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                        <div>
                            <strong style="color: var(--text-main); font-size: 0.9rem;">${d.label || 'Unnamed'}</strong>
                            <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 10px;">${date}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${status}
                            ${revokeBtn}
                        </div>
                    </div>
                `;
            }).join('');
            lucide.createIcons();
        } else {
            listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No delegation links created yet.</p>';
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Could not load links.</p>';
    }
}

async function revokeDelegate(token) {
    const session = JSON.parse(sessionStorage.getItem('vault_session'));
    if (!session) return;
    if (!confirm('Revoke this delegation link? Staff will no longer be able to submit items.')) return;

    try {
        await fetch('/api/vault/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId, token: token })
        });
        loadDelegates();
    } catch (e) {
        alert('Connection error.');
    }
}


// --------------------------------------------------------
// HEIR ACCESS LINK (Client-Side E2E Encrypted)
// --------------------------------------------------------

async function createHeirLink() {
    const existing = document.getElementById('heir-modal');
    if (existing) { existing.remove(); return; }

    const modal = document.createElement('div');
    modal.id = 'heir-modal';
    modal.style.cssText = 'position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div style="background: var(--bg-card, #111); border: 1px solid var(--border, #222); border-radius: 16px; padding: 2rem; width: 90%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem;">Create Heir Access</h3>
                <button onclick="document.getElementById('heir-modal').remove()" style="background: none; border: none; color: #666; cursor: pointer; font-size: 1.5rem; line-height: 1;">&times;</button>
            </div>
            <p style="color: #666; font-size: 0.8rem; margin-bottom: 1.5rem;">
                This generates an <strong style="color:#aaa;">encrypted vault file</strong> and a <strong style="color:#aaa;">decryption link</strong>. 
                Send both to your heir via a secure channel. Nothing is stored on our server.
            </p>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; margin-bottom: 4px;">Heir Name *</label>
                    <input type="text" id="heir-name" placeholder="e.g. Alexander, Victoria" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                </div>
                <div id="heir-result" style="display: none;"></div>
                <button id="heir-submit-btn" onclick="generateHeirPackage()" style="width: 100%; padding: 14px; background: transparent; border: 1px solid rgba(212,175,55,0.5); color: #D4AF37; border-radius: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#D4AF37';this.style.color='#050505'" onmouseout="this.style.background='transparent';this.style.color='#D4AF37'">Encrypt & Generate</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('heir-name')?.focus(), 100);
}

async function generateHeirPackage() {
    const name = document.getElementById('heir-name')?.value.trim();
    if (!name) {
        document.getElementById('heir-name').style.borderColor = 'rgba(224,82,82,0.5)';
        return;
    }

    const btn = document.getElementById('heir-submit-btn');
    btn.textContent = 'Encrypting...';
    btn.disabled = true;

    try {
        // Get vault data
        const rawData = localStorage.getItem('omnia_data');
        if (!rawData) { alert('No vault data to encrypt.'); return; }

        const session = JSON.parse(sessionStorage.getItem('vault_session') || '{}');
        const payload = JSON.stringify({
            ownerName: session.displayName || 'Principal',
            heirName: name,
            exportDate: new Date().toISOString(),
            vault: JSON.parse(rawData)
        });

        // Generate AES-256-GCM key
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
        );

        // Encrypt
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(payload);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv }, key, encoded
        );

        // Export key as base64url
        const keyRaw = await crypto.subtle.exportKey('raw', key);
        const keyB64 = btoa(String.fromCharCode(...new Uint8Array(keyRaw)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        // Package: iv (12 bytes) + ciphertext
        const package_ = new Uint8Array(iv.length + encrypted.byteLength);
        package_.set(iv, 0);
        package_.set(new Uint8Array(encrypted), iv.length);

        // Download encrypted file
        const blob = new Blob([package_], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Heritage_${name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.omnia.enc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Generate decryption link (key in hash - never sent to server)
        const heirLink = `${window.location.origin}/omnia-vault/heir.html#${keyB64}`;

        // Show result
        document.getElementById('heir-result').style.display = 'block';
        document.getElementById('heir-result').innerHTML = `
            <div style="padding: 1rem; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; margin-bottom: 1rem;">
                <p style="color: #10b981; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">✓ Step 1: Encrypted file downloaded</p>
                <p style="color: #888; font-size: 0.75rem;">Send the <code style="color:#D4AF37;">.omnia.enc</code> file to ${name}</p>
            </div>
            <div style="padding: 1rem; background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.2); border-radius: 8px;">
                <p style="color: #D4AF37; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">✓ Step 2: Send decryption link</p>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
                    <input type="text" id="heir-link-url" readonly value="${heirLink}" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #D4AF37; padding: 10px 12px; border-radius: 6px; font-size: 0.7rem; font-family: monospace;">
                    <button onclick="document.getElementById('heir-link-url').select(); navigator.clipboard.writeText(document.getElementById('heir-link-url').value); this.textContent='✓'" style="white-space: nowrap; padding: 10px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Copy</button>
                </div>
            </div>
        `;
        btn.style.display = 'none';
        addAlert('heart-handshake', `Heir Package: ${name}`, 'Encrypted vault file generated for designated successor', 'info');

    } catch (e) {
        console.error('Encryption error:', e);
        btn.textContent = 'Error — try again';
        btn.disabled = false;
    }
}


// --------------------------------------------------------
// LOCAL VAULT LOGIC
// --------------------------------------------------------

function toggleBlur(element) {
    element.classList.toggle('blurred');
}

function initVault() {
    if (!localStorage.getItem('omnia_initialized')) {
        const demoData = {
            "net_worth": 0,
            "assets": [],
            "last_sync": new Date().toISOString()
        };
        localStorage.setItem('omnia_data', JSON.stringify(demoData));
        localStorage.setItem('omnia_initialized', 'true');
    }
}

function updateDisplay() {
    const rawData = localStorage.getItem('omnia_data');
    if (!rawData) return;

    try {
        const data = JSON.parse(rawData);
        const nwDisplay = document.getElementById('net-worth-display');
        if (nwDisplay) {
            const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.net_worth);
            nwDisplay.innerText = formatted.replace('$', '$ ');
        }

        // Render dynamic asset grid
        const assetsGrid = document.getElementById('assets-grid');
        if (assetsGrid && data.assets) {
            assetsGrid.innerHTML = '';

            if (data.assets.length === 0) {
                assetsGrid.innerHTML = `
                    <div class="estate-card" style="display: flex; align-items: center; justify-content: center; min-height: 200px; opacity: 0.5;">
                        <div style="text-align: center;">
                            <p style="color: var(--text-muted); font-size: 0.9rem;">No assets yet.</p>
                            <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Add assets manually or generate a delegation link for your staff.</p>
                        </div>
                    </div>
                `;
            } else {
                // Pick images based on asset type
                const typeImages = {
                    'Real Estate': 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=600&auto=format&fit=crop',
                    'Fine Art': 'https://images.unsplash.com/photo-1541888082476-eb36940d9cb5?q=80&w=600&auto=format&fit=crop',
                    'Haute Couture': 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=600&auto=format&fit=crop',
                    'Watches': 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=600&auto=format&fit=crop',
                    'Yacht': 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?q=80&w=600&auto=format&fit=crop',
                    'Vehicle': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600&auto=format&fit=crop',
                    'Wine': 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=600&auto=format&fit=crop',
                    'default': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=600&auto=format&fit=crop'
                };

                data.assets.forEach(asset => {
                    const bgImage = typeImages[asset.type] || typeImages['default'];
                    const valueStr = asset.value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(asset.value) : '—';

                    const cardHtml = `
                        <div class="estate-card">
                            <div class="card-img" style="background-image: url('${bgImage}');"></div>
                            <div class="card-content">
                                <div class="card-header">
                                    <div>
                                        <h4>${asset.name}</h4>
                                        <p class="location" style="text-transform: capitalize;"><i data-lucide="gem"></i> ${asset.type}</p>
                                    </div>
                                    <button class="more-btn"><i data-lucide="more-vertical"></i></button>
                                </div>
                                <div class="card-stats">
                                    <div class="stat"><span class="val">${valueStr}</span><span class="lbl">Value</span></div>
                                    <div class="stat"><span class="val">Secured</span><span class="lbl">Status</span></div>
                                </div>
                            </div>
                        </div>
                    `;
                    assetsGrid.insertAdjacentHTML('beforeend', cardHtml);
                });
            }
            lucide.createIcons();
        }

    } catch (e) {
        console.error("Failed to parse vault data", e);
    }
}

function addAsset() {
    const existing = document.getElementById('add-asset-modal');
    if (existing) { existing.remove(); return; }

    // Detect current view for context-awareness
    const activeView = document.querySelector('.vault-view[style*="display: block"]');
    const activeId = activeView ? activeView.id : 'view-overview';

    const contextMap = {
        'view-overview':    { title: 'Add New Asset',       defaultType: 'Other',         placeholder: 'e.g. Patek Philippe Nautilus 5711' },
        'view-estates':     { title: 'Add Estate',          defaultType: 'Real Estate',   placeholder: 'e.g. London Townhouse, Mayfair' },
        'view-mobility':    { title: 'Add Vehicle / Vessel',defaultType: 'Vehicle',       placeholder: 'e.g. M/Y Serenity, Ferrari 250 GTO' },
        'view-collections': { title: 'Add to Collection',   defaultType: 'Fine Art',      placeholder: 'e.g. Picasso Sketch, Hermès Birkin' },
        'view-documents':   { title: 'Add Document',        defaultType: 'Document',      placeholder: 'e.g. Certificate of Authenticity' },
    };

    const ctx = contextMap[activeId] || contextMap['view-overview'];

    const typeOptions = [
        'Real Estate', 'Fine Art', 'Haute Couture', 'Watches', 'Jewelry',
        'Wine', 'Vehicle', 'Yacht', 'Aircraft', 'Document', 'Other'
    ].map(t => `<option value="${t}" ${t === ctx.defaultType ? 'selected' : ''}>${t}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'add-asset-modal';
    modal.style.cssText = 'position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div style="background: var(--bg-card, #111); border: 1px solid var(--border, #222); border-radius: 16px; padding: 2rem; width: 90%; max-width: 480px; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem;">${ctx.title}</h3>
                <button onclick="document.getElementById('add-asset-modal').remove()" style="background: none; border: none; color: #666; cursor: pointer; font-size: 1.5rem; line-height: 1;">&times;</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; margin-bottom: 4px;">Name *</label>
                    <input type="text" id="modal-asset-name" placeholder="${ctx.placeholder}" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; margin-bottom: 4px;">Type</label>
                        <select id="modal-asset-type" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                            ${typeOptions}
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #666; display: block; margin-bottom: 4px;">Value (USD)</label>
                        <input type="number" id="modal-asset-value" placeholder="0" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                    </div>
                </div>
                <button onclick="submitAssetFromModal()" style="width: 100%; padding: 14px; background: transparent; border: 1px solid rgba(212,175,55,0.5); color: #D4AF37; border-radius: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#D4AF37';this.style.color='#050505'" onmouseout="this.style.background='transparent';this.style.color='#D4AF37'">${ctx.title}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('modal-asset-name')?.focus(), 100);
}

function submitAssetFromModal() {
    const name = document.getElementById('modal-asset-name')?.value.trim();
    const type = document.getElementById('modal-asset-type')?.value || 'Other';
    const value = parseInt(document.getElementById('modal-asset-value')?.value || '0', 10) || 0;

    if (!name) {
        document.getElementById('modal-asset-name').style.borderColor = 'rgba(224,82,82,0.5)';
        return;
    }

    const rawData = localStorage.getItem('omnia_data');
    if (rawData) {
        let data = JSON.parse(rawData);
        data.net_worth += value;
        data.assets.push({ id: Date.now().toString(), name: name, type: type, value: value });
        localStorage.setItem('omnia_data', JSON.stringify(data));
        updateDisplay();
        addAlert('plus-circle', `Asset Added: ${name}`, `${type} — $${value.toLocaleString()}`, 'info');
    }
    document.getElementById('add-asset-modal')?.remove();
}


// --------------------------------------------------------
// EXPORT / IMPORT (.omnia files)
// --------------------------------------------------------

function exportVault() {
    const vaultData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        vaultData[key] = localStorage.getItem(key);
    }
    vaultData['_export_date'] = new Date().toISOString();

    const dataStr = JSON.stringify(vaultData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniaVault_${new Date().toISOString().split('T')[0]}.omnia`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importVault(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const vaultData = JSON.parse(e.target.result);
            localStorage.clear();
            for (const key in vaultData) {
                if (key !== '_export_date') {
                    localStorage.setItem(key, vaultData[key]);
                }
            }
            alert("Vault successfully restored!");
            location.reload();
        } catch (error) {
            alert("Error: Invalid or corrupted Vault file.");
            console.error("Import Error:", error);
        }
    };
    reader.readAsText(file);
}


// --------------------------------------------------------
// ALERTS / NOTIFICATIONS SYSTEM (Local)
// --------------------------------------------------------

function initAlerts() {
    if (!localStorage.getItem('omnia_alerts')) {
        localStorage.setItem('omnia_alerts', JSON.stringify([]));
    }
    updateAlertsBadge();
}

function addAlert(icon, title, message, type = 'info') {
    const alerts = JSON.parse(localStorage.getItem('omnia_alerts') || '[]');
    alerts.unshift({
        id: Date.now(),
        icon: icon,
        title: title,
        message: message,
        type: type, // 'info', 'warning', 'success'
        time: new Date().toISOString(),
        read: false
    });
    // Keep max 50 alerts
    if (alerts.length > 50) alerts.pop();
    localStorage.setItem('omnia_alerts', JSON.stringify(alerts));
    updateAlertsBadge();
}

function updateAlertsBadge() {
    const alerts = JSON.parse(localStorage.getItem('omnia_alerts') || '[]');
    const unread = alerts.filter(a => !a.read).length;
    const badge = document.getElementById('alerts-badge');
    if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }
}

function renderAlerts() {
    const alerts = JSON.parse(localStorage.getItem('omnia_alerts') || '[]');
    const listEl = document.getElementById('alerts-list');
    if (!listEl) return;

    // Mark all as read
    alerts.forEach(a => a.read = true);
    localStorage.setItem('omnia_alerts', JSON.stringify(alerts));
    updateAlertsBadge();

    if (alerts.length === 0) {
        listEl.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications</div>';
        return;
    }

    const typeColors = {
        'info': 'var(--gold)',
        'warning': '#f59e0b',
        'success': '#10b981',
        'danger': '#ef4444'
    };

    listEl.innerHTML = alerts.map(a => {
        const color = typeColors[a.type] || typeColors.info;
        const ago = timeAgo(new Date(a.time));
        return `
            <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start;">
                <div style="min-width: 32px; height: 32px; border-radius: 8px; background: ${color}15; border: 1px solid ${color}30; display: grid; place-items: center;">
                    <i data-lucide="${a.icon}" style="width: 16px; height: 16px; color: ${color};"></i>
                </div>
                <div style="flex: 1;">
                    <p style="font-size: 0.85rem; color: var(--text-main); margin: 0 0 2px 0;">${a.title}</p>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">${a.message}</p>
                    <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; display: block;">${ago}</span>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function clearAlerts() {
    localStorage.setItem('omnia_alerts', JSON.stringify([]));
    renderAlerts();
    updateAlertsBadge();
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}
