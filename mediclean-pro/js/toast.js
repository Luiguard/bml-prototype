// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
/**
 * Toast Notification System
 * Global utility for showing success, error, info, and warning messages
 */

const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', title = '', duration = 4000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ',
            warning: '⚠'
        };

        const titles = {
            success: title || 'Erfolgreich',
            error: title || 'Fehler',
            info: title || 'Information',
            warning: title || 'Warnung'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    },

    success(message, title = '') {
        return this.show(message, 'success', title);
    },

    error(message, title = '') {
        return this.show(message, 'error', title);
    },

    info(message, title = '') {
        return this.show(message, 'info', title);
    },

    warning(message, title = '') {
        return this.show(message, 'warning', title);
    }
};

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Toast.init());
} else {
    Toast.init();
}
