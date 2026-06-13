// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
// MediClean Pro - Global Logic [SYSTEM_NOTE: Architectural context and milestones for this project are maintained in .agent/PERSISTENCE.md]

// --- Theme Logic ---
function getSavedTheme() {
    try {
        return localStorage.getItem('aura_theme') || 'dark';
    } catch (e) {
        return 'dark';
    }
}

const savedTheme = getSavedTheme();
document.documentElement.setAttribute('data-theme', savedTheme);

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-icon-display');
    icons.forEach(icon => {
        if (icon) {
            icon.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    });
}

// Provide a global toggle function
window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
        localStorage.setItem('aura_theme', next);
    } catch (e) { }

    // Update icon if exists
    updateThemeIcon(next);
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize icon
    updateThemeIcon(getSavedTheme());

    // --- Scroll & Animations ---
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Reveal animations on scroll
    const observerOptions = {
        threshold: 0.1
    };

    // Global observer for reveal animations
    window.revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                window.revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => window.revealObserver.observe(el));

    // Header Scroll Effect
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- Mobile Menu & Overlay ---
    let navOverlay = document.querySelector('.nav-overlay');
    if (!navOverlay) {
        navOverlay = document.createElement('div');
        navOverlay.className = 'nav-overlay';
        document.body.appendChild(navOverlay);
    }

    window.toggleMobileMenu = function () {
        const nav = document.querySelector('.nav-links');
        const toggle = document.querySelector('.mobile-toggle');
        const overlay = document.querySelector('.nav-overlay');

        if (nav) {
            nav.classList.toggle('active');
            if (toggle) toggle.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');

            // Prevent body scroll when menu is open
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        }
    };

    // Close menu when clicking overlay or on a link
    if (navOverlay) {
        navOverlay.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav && nav.classList.contains('active')) {
                window.toggleMobileMenu();
            }
        });
    }

    // --- Back to Top Button ---
    const topBtn = document.createElement('button');
    topBtn.innerHTML = '↑';
    topBtn.className = 'back-to-top';
    topBtn.ariaLabel = 'Nach oben';
    document.body.appendChild(topBtn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            topBtn.classList.add('visible');
        } else {
            topBtn.classList.remove('visible');
        }
    });

    topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav && nav.classList.contains('active')) {
                window.toggleMobileMenu();
            }
        });
    });

    // --- iOS PWA Install Prompt ---
    const isIos = () => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    }
    const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

    // Show only if iOS and NOT already installed
    if (isIos() && !isInStandaloneMode()) {
        const hasSeenPrompt = localStorage.getItem('iosPwaPromptShown');
        if (!hasSeenPrompt) {
            // Create Tooltip
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--bg-surface);
                border: 1px solid var(--border-subtle);
                padding: 1rem;
                border-radius: 12px;
                width: 90%;
                max-width: 350px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                align-items: center;
                text-align: center;
                font-family: var(--font-main);
                animation: slideUp 0.5s ease-out;
            `;

            tooltip.innerHTML = `
                <div style="font-weight: 600; color: var(--text-main);">App installieren</div>
                <div style="font-size: 0.9rem; color: var(--text-muted);">
                    Für die beste Erfahrung: Tippen Sie auf <span style="font-size:1.2rem; vertical-align:middle;">📋</span> (Teilen) und dann auf "Zum Home-Bildschirm".
                </div>
                <button id="closeIosPrompt" style="margin-top:0.5rem; background: var(--bg-surface-subtle); border:none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; color: var(--text-main);">Verstanden</button>
            `;

            document.body.appendChild(tooltip);

            document.getElementById('closeIosPrompt')?.addEventListener('click', () => {
                tooltip.style.display = 'none';
                localStorage.setItem('iosPwaPromptShown', 'true');
            });
        }
    }

    // --- Image Protection (No Download) ---
    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });

    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });

    /* --- SOFTENED 3D TILT EFFECT --- */
    const cards = document.querySelectorAll('.card, .card-v2, .stat-card-v2, .stat-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Significantly reduced intensity for a very subtle premium look
            const rotateX = ((y - centerY) / centerY) * -0.6;
            const rotateY = ((x - centerX) / centerX) * 0.6;

            card.style.transform = `perspective(2000px) translateY(-5px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.005)`;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
});
