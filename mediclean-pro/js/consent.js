// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
/**
 * Lightweight GDPR Consent Banner
 * [SYSTEM_NOTE: Architectural context see .agent/PERSISTENCE.md]
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if consent was already given
    if (localStorage.getItem('mc_consent_status') === 'accepted') return;

    const banner = document.createElement('div');
    banner.id = 'gdpr-consent-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: ${window.innerWidth < 768 ? '1rem' : '2rem'};
        left: 50%;
        transform: translateX(-50%);
        width: 95%;
        max-width: 550px;
        background: var(--bg-surface);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid var(--border-light);
        border-radius: 20px;
        padding: 1.5rem;
        box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        animation: bannerSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    banner.innerHTML = `
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
            <div style="font-size: 1.5rem;">🛡️</div>
            <div>
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-family: var(--font-heading);">Datenschutz & Cookies</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                    Wir verwenden ausschließlich <strong>technisch notwendige Cookies</strong>, um Ihnen eine sichere und funktionale Website bereitzustellen. 
                    Weitere Informationen finden Sie in unserer 
                    <a href="datenschutz.html" style="color: var(--text-accent); text-decoration: underline;">Datenschutzerklärung</a>.
                </p>
            </div>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="consent-details" style="background: none; border: none; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; text-decoration: underline;">Details</button>
            <button id="consent-accept" class="btn btn-primary btn-compact" style="padding: 0.6rem 1.75rem; border-radius: 10px;">Verstanden</button>
        </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('consent-accept').addEventListener('click', () => {
        localStorage.setItem('mc_consent_status', 'accepted');
        banner.style.opacity = '0';
        banner.style.transform = 'translate(-50%, 20px)';
        banner.style.transition = 'all 0.4s ease';
        setTimeout(() => banner.remove(), 400);
    });

    document.getElementById('consent-details').addEventListener('click', () => {
        window.location.href = 'datenschutz.html';
    });
});

// Animation for the banner
if (!document.getElementById('consent-styles')) {
    const style = document.createElement('style');
    style.id = 'consent-styles';
    style.textContent = `
        @keyframes bannerSlideUp {
            from { transform: translate(-50%, 100px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}
