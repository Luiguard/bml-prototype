/**
 * MediClean Pro - Premium PWA Installation Handler (v2.1)
 * Optimized for high-speed capture and Android/Chrome reliability.
 */

(function () {
    let floatingBtn;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // 1. Create UI Component
    function createFloatingButton() {
        floatingBtn = document.getElementById('pwa-floating-install');
        if (floatingBtn) {
            if (isStandalone) floatingBtn.style.display = 'none';
            return;
        }

        if (isStandalone) return;

        const div = document.createElement('div');
        div.id = 'pwa-floating-install';
        div.className = 'floating-install-btn';
        div.style.display = 'none';
        div.innerHTML = `
            <button onclick="window.triggerPWAInstall()" aria-label="App installieren">
                <span class="icon">📲</span>
                <span class="text">App installieren</span>
            </button>
        `;
        document.body.appendChild(div);
        floatingBtn = div;

        // If event was already captured by the head script, show it now
        if (window.deferredPrompt) {
            window.showPWAInstallationUI();
        }
    }

    // 2. Event Bridge: Head script calls this when prompt is ready
    window.showPWAInstallationUI = () => {
        if (floatingBtn && !isStandalone) {
            floatingBtn.style.display = 'block';
            console.log('✨ PWA: UI Visibility Unlocked');

            // Debug Indicator
            const indicator = document.createElement('div');
            indicator.style.cssText = "position:fixed; bottom:2px; right:2px; width:4px; height:4px; background:#10b981; border-radius:50%; z-index:9999; pointer-events:none;";
            document.body.appendChild(indicator);
        }
    };

    // 3. Installation Trigger
    window.triggerPWAInstall = async () => {
        console.log('PWA: Installation request. Prompt ready:', !!window.deferredPrompt);

        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            console.log(`PWA: Install Outcome: ${outcome}`);
            if (outcome === 'accepted') {
                if (floatingBtn) floatingBtn.style.display = 'none';
            }
            window.deferredPrompt = null;
        } else {
            if (isStandalone) {
                alert("✨ MediClean Pro ist bereits als App installiert!");
            } else {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                if (isIOS) {
                    alert("📱 Installation auf iOS:\n\n1. Tippen Sie auf das 'Teilen'-Icon (Quadrat mit Pfeil).\n2. Scrollen Sie nach unten und wählen Sie 'Zum Home-Bildschirm'.");
                } else {
                    const isAndroid = /Android/.test(navigator.userAgent);
                    if (isAndroid) {
                        alert("🤖 App-Installation auf Android:\n\nDer Browser hat den schnellen Installations-Dialog noch nicht freigegeben.\n\nAlternative:\n1. Tippen Sie auf ⋮ (oben rechts).\n2. Wählen Sie 'App installieren' oder 'Zum Startbildschirm hinzufügen'.");
                    } else {
                        alert("Die App-Installation ist derzeit im Browser-Menü verfügbar. Suchen Sie nach dem Installations-Icon (+) in der Adresszeile.");
                    }
                }
            }
        }
    };

    // 4. Service Worker Hub
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Using absolute path for SW to avoid subdirectory issues
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(reg => {
                    console.log('PWA: SW Registered. Range:', reg.scope);

                    // Check for updates
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('PWA: New content available; please refresh.');
                            }
                        };
                    };
                })
                .catch(err => console.error('PWA: SW Error:', err));
        });

        // Local listener (Backup for head script)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            window.showPWAInstallationUI();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA: Successfully installed');
            if (floatingBtn) floatingBtn.style.display = 'none';
        });
    }

    // Auto-Force visibility for Engagement (Heuristics) after 8s
    setTimeout(() => {
        if (floatingBtn && !isStandalone && !window.deferredPrompt) {
            floatingBtn.style.display = 'block';
            console.log('PWA: Engagement timer triggered');
        }
    }, 8000);

    // 5. Push Notification Subscription
    window.subscribeForPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check current status
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                console.log('User already has a subscription');
                // We still send it to be sure user_id is linked correctly
                await sendSubToServer(existingSub);
                return;
            }

            // Fetch VAPID Key from server
            const configRes = await fetch('/api/v1/system/network');
            const config = await configRes.json();
            const vapidPublicKey = config.vapidPublicKey;

            if (!vapidPublicKey) {
                console.warn('VAPID Key not available from server');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            console.log('Push Subscription successful');
            await sendSubToServer(subscription);

        } catch (error) {
            console.error('Failed to subscribe to push notifications', error);
        }
    };

    async function sendSubToServer(subscription) {
        const user = JSON.parse(localStorage.getItem('aura_current_user') || 'null');
        if (!user || !user.id) return;

        try {
            await fetch('/api/save_subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    target_id: user.id
                })
            });
            console.log('Subscription synced with server');
        } catch (e) {
            console.error('Error syncing subscription', e);
        }
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Auto-subscribe if logged in
    if (localStorage.getItem('aura_current_user')) {
        setTimeout(window.subscribeForPush, 3000);
    }

    // Initial Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingButton);
    } else {
        createFloatingButton();
    }
})();
