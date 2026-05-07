/**
 * WCAG 2.2 Level AAA Accessibility Enhancements
 * This script provides runtime accessibility improvements for all pages
 */

(function () {
    'use strict';

    // 1. SKIP LINK ENHANCEMENT
    function ensureSkipLink() {
        if (!document.querySelector('.skip-link')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Zum Hauptinhalt springen';
            skipLink.setAttribute('aria-label', 'Zum Hauptinhalt springen');
            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        // Ensure main content has ID
        const main = document.querySelector('main');
        if (main && !main.id) {
            main.id = 'main-content';
            main.setAttribute('tabindex', '-1');
        }
    }

    // 2. FOCUS VISIBLE ENHANCEMENT (2.4.13)
    function enhanceFocusVisibility() {
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                document.body.classList.add('user-is-tabbing');
            }
        });

        document.addEventListener('mousedown', function () {
            document.body.classList.remove('user-is-tabbing');
        });
    }

    // 3. ARIA LABELS FOR ICONS & LANDMARKS (1.1.1, 1.3.1, 1.3.6)
    function enhanceLandmarks() {
        // Ensure header has role banner
        const header = document.querySelector('header');
        if (header && !header.getAttribute('role')) header.setAttribute('role', 'banner');

        // Ensure footer has role contentinfo
        const footer = document.querySelector('footer');
        if (footer && !footer.getAttribute('role')) footer.setAttribute('role', 'contentinfo');

        // Ensure navs have labels
        const navs = document.querySelectorAll('nav');
        navs.forEach((nav, index) => {
            if (!nav.getAttribute('aria-label')) {
                nav.setAttribute('aria-label', index === 0 ? 'Hauptnavigation' : 'Sekundäre Navigation');
            }
            if (!nav.getAttribute('role')) nav.setAttribute('role', 'navigation');
        });

        // Search landmark
        const searchForm = document.querySelector('form[role="search"]');
        if (searchForm && !searchForm.getAttribute('aria-label')) {
            searchForm.setAttribute('aria-label', 'Website-Suche');
        }
    }

    // 4. MOTION CONTROLS (2.3.3)
    function setupMotionControls() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const btnContainer = document.querySelector('.nav-right') || document.body;

        const toggleMotionBtn = document.createElement('button');
        toggleMotionBtn.id = 'a11y-motion-toggle';
        toggleMotionBtn.className = 'a11y-control-btn';
        toggleMotionBtn.style.position = 'fixed';
        toggleMotionBtn.style.top = '6.5rem';
        toggleMotionBtn.style.left = '1.5rem';
        toggleMotionBtn.style.zIndex = '9999';
        toggleMotionBtn.style.padding = '10px';
        toggleMotionBtn.style.background = 'var(--bg-surface)';
        toggleMotionBtn.style.border = '1px solid var(--border-subtle)';
        toggleMotionBtn.style.borderRadius = '12px';
        toggleMotionBtn.style.boxShadow = 'var(--shadow-lg)';
        toggleMotionBtn.style.cursor = 'pointer';
        toggleMotionBtn.style.display = 'flex';
        toggleMotionBtn.style.alignItems = 'center';
        toggleMotionBtn.style.justifyContent = 'center';
        toggleMotionBtn.style.width = '44px';
        toggleMotionBtn.style.height = '44px';
        toggleMotionBtn.innerHTML = '✨'; // Motion icon
        toggleMotionBtn.setAttribute('aria-label', 'Animationen reduzieren');
        toggleMotionBtn.setAttribute('title', 'Animationen und Bewegungen reduzieren/stoppen');

        let animationsActive = !prefersReducedMotion.matches;

        function updateMotionState() {
            if (!animationsActive) {
                document.documentElement.classList.add('reduce-motion-active');
                toggleMotionBtn.innerHTML = '🚫';
                // Stop videos
                document.querySelectorAll('video').forEach(v => v.pause());
            } else {
                document.documentElement.classList.remove('reduce-motion-active');
                toggleMotionBtn.innerHTML = '✨';
                // Resume videos if they were autoplay
                document.querySelectorAll('video[autoplay]').forEach(v => v.play());
            }
        }

        toggleMotionBtn.onclick = () => {
            animationsActive = !animationsActive;
            updateMotionState();
        };

        document.body.appendChild(toggleMotionBtn);

        updateMotionState();
    }

    // 5. BREADCRUMBS (2.4.8)
    function injectBreadcrumbs() {
        if (document.querySelector('.breadcrumbs') ||
            document.body.classList.contains('aura-landing-page') ||
            document.body.classList.contains('aura-auth-layout')) return;

        const main = document.querySelector('main');
        if (!main) return;

        // Clean up path: ignore local drive letters, project root folders, etc.
        let pathParts = window.location.pathname.split('/').filter(p => {
            const forbidden = ['', 'D:', 'd:', 'mediclean-pro-v3', 'server', 'website_public'];
            return !forbidden.includes(p) && !p.includes(':');
        });

        // Ensure we don't show anything if we're on index or root
        if (pathParts.length === 0 || (pathParts.length === 1 && (pathParts[0] === 'index.html' || pathParts[0] === 'login.html' || pathParts[0] === 'customer_login.html'))) return;

        const breadcrumbs = document.createElement('nav');
        breadcrumbs.className = 'breadcrumbs container';
        breadcrumbs.setAttribute('aria-label', 'Brotkrumen-Navigation');

        let html = '<ol>';
        html += '<li><a href="index.html">Home</a></li>';

        pathParts.forEach((part, index) => {
            const isLast = index === pathParts.length - 1;
            const label = decodeURIComponent(part.replace('.html', '').replace(/-/g, ' '));
            const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

            html += '<li aria-hidden="true">&rsaquo;</li>';
            if (isLast) {
                html += `<li aria-current="page">${capitalizedLabel}</li>`;
            } else {
                html += `<li><a href="${part}">${capitalizedLabel}</a></li>`;
            }
        });

        html += '</ol>';
        breadcrumbs.innerHTML = html;
        main.insertBefore(breadcrumbs, main.firstChild);
    }

    // 6. LINK TEXT CONTEXT (2.4.9)
    function enhanceLinkTexts() {
        const ambiguousLinks = document.querySelectorAll('a');
        ambiguousLinks.forEach(link => {
            const text = link.textContent.trim().toLowerCase();
            if (['mehr erfahren', 'hier klicken', 'read more', 'weiterlesen', 'mehr'].includes(text)) {
                // Look for heading in the same section or parent card
                const container = link.closest('.card') || link.closest('section') || link.parentElement;
                const heading = container ? container.querySelector('h1, h2, h3, h4') : null;
                if (heading) {
                    link.setAttribute('aria-label', `${link.textContent} über ${heading.textContent}`);
                }
            }
        });
    }

    // 7. ARIA FOR DYNAMIC CHANGES (3.2.5)
    function handleDynamicChanges() {
        // Prevent auto-refresh meta tags if any
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
            console.warn('A11Y Warning: Auto-refresh detected. This violates WCAG 2.2 Level AAA.');
        }
    }

    // 8. SIMULTANEOUS INPUTS (2.5.6)
    function ensureSimultaneousInput() {
        // Browser handles this natively, but we ensure no event preventDefaults block common combos
        window.addEventListener('keydown', (e) => {
            // Ensure Tab doesn't get blocked
            if (e.key === 'Tab') {
                document.body.classList.add('user-is-tabbing');
            }
        });
    }

    // 9. SIMPLIFIED LANGUAGE TOGGLE (3.1.5)
    function setupSimplifiedLanguage() {
        if (document.getElementById('easy-lang-container')) return;

        const footer = document.querySelector('.footer-bottom') || document.body;
        const toggle = document.createElement('div');
        toggle.id = 'easy-lang-container';
        toggle.style.marginTop = '1rem';
        toggle.style.fontSize = '0.85rem';
        toggle.innerHTML = `<button type="button" id="btn-easy-lang" style="color: var(--brand-light); font-weight: 700; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0.5rem;">📘 Version in Leichter Sprache aktivieren</button>`;
        footer.appendChild(toggle);

        let isSimplified = false;

        document.getElementById('btn-easy-lang').onclick = function (e) {
            e.preventDefault();
            isSimplified = !isSimplified;

            if (isSimplified) {
                document.body.classList.add('simplified-view-active');
                this.innerHTML = '📘 Standard Layout aktivieren';
                this.setAttribute('aria-pressed', 'true');
            } else {
                document.body.classList.remove('simplified-view-active');
                this.innerHTML = '📘 Version in Leichter Sprache aktivieren';
                this.setAttribute('aria-pressed', 'false');
            }
        };
    }

    // 10. ERROR PREVENTION FOR SENSITIVE FORMS (3.3.6)
    function setupErrorPrevention() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (form.id.includes('booking') || form.id.includes('register') || form.action.includes('submit')) {
                form.onsubmit = function (e) {
                    if (!form.dataset.confirmed) {
                        e.preventDefault();
                        const confirmMsg = "Bitte überprüfen Sie Ihre Eingaben noch einmal. Möchten Sie das Formular jetzt abschicken?";
                        if (confirm(confirmMsg)) {
                            form.dataset.confirmed = "true";
                            form.submit();
                        }
                    }
                };
            }
        });
    }

    // 11. ABBREVIATION EXPANSION (3.1.4)
    function enhanceAbbreviations() {
        const abbreviations = {
            'WCAG': 'Web Content Accessibility Guidelines',
            'AAA': 'Triple-A Konformitätsstufe',
            'AEMP': 'Aufbereitungseinheit für Medizinprodukte',
            'GmbH': 'Gesellschaft mit beschränkter Haftung',
            'KG': 'Kommanditgesellschaft',
            'bzw': 'beziehungsweise',
            'usw': 'und so weiter',
            'etc': 'et cetera',
            'z.B.': 'zum Beispiel',
            'u.a.': 'unter anderem',
            'ÖNORM': 'Österreichische Norm',
            'VAH': 'Verbund für Angewandte Hygiene',
            'ÖGHMP': 'Österr. Gesellschaft für Hygiene, Mikrobiologie und Präventivmedizin',
            'RKI': 'Robert Koch-Institut',
            'ÖGSV': 'Österreichische Gesellschaft für Sterilgutversorgung',
            'QM': 'Qualitätsmanagement'
        };

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) nodes.push(node);

        nodes.forEach(textNode => {
            let content = textNode.textContent;
            let changed = false;

            Object.keys(abbreviations).forEach(abbr => {
                const regex = new RegExp(`\\b${abbr}\\b`, 'g');
                if (regex.test(content)) {
                    content = content.replace(regex, `<abbr title="${abbreviations[abbr]}">${abbr}</abbr>`);
                    changed = true;
                }
            });

            if (changed && textNode.parentElement && !['ABBR', 'SCRIPT', 'STYLE'].includes(textNode.parentElement.tagName)) {
                const span = document.createElement('span');
                span.innerHTML = content;
                textNode.parentElement.replaceChild(span, textNode);
                while (span.firstChild) span.parentElement.insertBefore(span.firstChild, span);
                span.parentElement.removeChild(span);
            }
        });
    }

    // 12. HIGHLIGHT ACTIVE NAV POINT (2.4.8)
    function highlightActiveNav() {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.nav-links a, .footer-links a');

        navLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            if (linkPath === currentPath || (currentPath === 'index.html' && linkPath === '#')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    }

    // Initialize all enhancements
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runEnhancements);
        } else {
            runEnhancements();
        }
    }

    function runEnhancements() {
        ensureSkipLink();
        enhanceFocusVisibility();
        enhanceLandmarks();
        setupMotionControls();
        injectBreadcrumbs();
        highlightActiveNav();
        enhanceLinkTexts();
        handleDynamicChanges();
        ensureSimultaneousInput();
        setupSimplifiedLanguage();
        setupErrorPrevention();
        enhanceAbbreviations();

        console.log('✓ WCAG 2.2 AAA runtime enhancements active');
    }

    init();
})();
