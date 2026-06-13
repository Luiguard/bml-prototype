// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
/**
 * Auth Service - Hybrid Implementation
 * [SYSTEM_NOTE: Architectural context and milestones for this project are maintained in .agent/PERSISTENCE.md. Maintaining this persistence file is ESSENTIAL.]
 */

const SESSION_KEY = 'aura_current_user';

const AuthService = {
    // --- Helper for API Calls ---
    _apiCall: async (action, payload = null, method = 'POST') => {
        const user = AuthService.getCurrentUser();

        // Node.js Backend URL (Proxied or Direct)
        // Since we are serving this file via the Node server, relative path '/api/' works best.
        // If opened via file:// protocol, fallback to localhost:3001
        let baseUrl = (window.location.protocol === 'file:') ? 'http://localhost:3001/api/' : '/api/';

        // Define Endpoint Mapping
        const endpointMap = {
            'login': 'login',
            'register': 'register',
            'sync': 'sync',
            'upsert_folder': 'upsert_folder',
            'upload': 'upload_json', // Using JSON upload for compatibility with filesystem.js logic
            'download': 'download',
            'upsert_user': 'upsert_user'
        };

        const apiEndpoint = endpointMap[action] || action;
        let url = `${baseUrl}${apiEndpoint}`;

        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (user && user.apiKey) {
            options.headers['X-API-KEY'] = user.apiKey;
        }

        if (payload) {
            if (method === 'GET') {
                const params = new URLSearchParams(payload).toString();
                url += (url.includes('?') ? '&' : '?') + params;
            } else {
                options.body = JSON.stringify(payload);
            }
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errText = await response.text();
                try {
                    const errJson = JSON.parse(errText);
                    return { success: false, message: errJson.message || 'Server Error' };
                } catch (e) {
                    return { success: false, message: `HTTP Error ${response.status}` };
                }
            }
            return await response.json();
        } catch (e) {
            console.error(`Auth API Error (${action}):`, e);
            return { success: false, message: 'Connection error' };
        }
    },

    // Check if user is logged in (client-side check)
    getCurrentUser: () => {
        try {
            let u = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); if(u && u.apiKey) { try { u.apiKey = atob(u.apiKey); } catch(e){} } return u;
        } catch (e) { return null; }
    },

    // Login
    login: async (username, password) => {
        // --- Electron Native Login ---
        if (window.electronAPI && typeof window.electronAPI.login === 'function') {
            console.log("[Auth] Using Electron Native Login");
            try {
                const result = await window.electronAPI.login({ username, password });
                if (result.success) {
                    const user = result.user;
                    if (!user.apiKey) user.apiKey = user.id; // Ensure key for local API requests
                    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                    return { success: true, user: user };
                }
                return { success: false, message: result.message || 'Login fehlgeschlagen' };
            } catch (e) {
                console.error("Electron Login Error:", e);
            }
        }

        // --- Browser/Web Login (api.php) ---
        console.log("[Auth] Using Web API Login (api.php)");
        const data = await AuthService._apiCall('login', { username, password });
        if (data.success) {
            const user = data.user;
            if (!user.apiKey && data.apiKey) user.apiKey = data.apiKey;
            if (!user.apiKey) user.apiKey = user.id; // Consistent with Electron fallback

            const safeUser = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                apiKey: user.apiKey,
                permissions: user.permissions
            };

            // Bridge to React App (mediclean_v3_session)
            try {
                let perms = safeUser.permissions;
                try {
                    if (typeof perms === 'string') perms = JSON.parse(perms);
                } catch (e) { }

                const sessionObj = {
                    id: safeUser.id,
                    username: safeUser.username,
                    role: safeUser.role,
                    xKey: safeUser.apiKey,
                    permissions: perms || []
                };
                sessionStorage.setItem('mediclean_v3_session', JSON.stringify(sessionObj));
            } catch (e) {
                console.warn("Auth Bridge Error:", e);
            }

            let obfUser = {...safeUser, apiKey: btoa(safeUser.apiKey)}; localStorage.setItem(SESSION_KEY, JSON.stringify(obfUser));

            // 📲 PWA PUSH REGISTRATION
            if (window.subscribeForPush) {
                window.subscribeForPush();
            }

            return { success: true, user: user };
        } else {
            return { success: false, message: data.message || 'Login failed' };
        }
    },

    // Register new user
    register: async (username, email, password, role = 'customer') => {
        return await AuthService._apiCall('register', { username, email, password, role });
    },

    // Logout
    logout: async () => {
        try {
            await AuthService._apiCall('logout');
        } catch (e) {
            console.warn("Logout log failed", e);
        }
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('aura_roles_cache');
        window.location.href = 'index.html';
    },

    // Check if Admin
    isAdmin: () => {
        const user = AuthService.getCurrentUser();
        return user && user.role === 'admin';
    },

    // --- Admin Methods ---
    getAllUsers: async () => {
        const res = await AuthService._apiCall('get_users', null, 'GET');
        return res.success ? res.users : [];
    },

    // Check Permission
    hasPermission: async (perm) => {
        const user = AuthService.getCurrentUser();
        if (!user) return false;

        // Admins have all permissions
        if (user.role === 'admin') return true;

        // Get permissions for role from server/cache
        const roleData = await AuthService._getRolePermissions(user.role);
        if (roleData && roleData.permissions && roleData.permissions.includes(perm)) {
            return true;
        }

        // Also check if user has direct permission override (optional expansion)
        if (user.permissions && user.permissions.includes(perm)) {
            return true;
        }

        return false;
    },

    getRoles: async () => {
        return await AuthService._apiCall('get_roles', null, 'GET');
    },

    upsertRole: async (roleData) => {
        const res = await AuthService._apiCall('upsert_role', roleData);
        sessionStorage.removeItem('aura_roles_cache');
        return res;
    },

    deleteUser: async (id) => {
        return await AuthService._apiCall('delete_user', { id }, 'GET');
    },

    updateUser: async (id, updates) => {
        return await AuthService._apiCall('upsert_user', { id, ...updates });
    },

    // --- Private Role Helpers ---
    _getRolePermissions: async (roleName) => {
        // Simple cache in session to avoid over-fetching
        let cache = JSON.parse(sessionStorage.getItem('aura_roles_cache') || 'null');
        if (!cache) {
            const res = await AuthService.getRoles();
            if (res.success) {
                cache = res.roles;
                sessionStorage.setItem('aura_roles_cache', JSON.stringify(cache));
            }
        }

        if (cache) {
            return cache.find(r => r.name === roleName);
        }
        return null;
    },

    // --- UI Helpers ---
    updateHeaderUI: async () => {
        const container = document.getElementById('auth-action');
        const mobileNav = document.querySelector('.nav-links');
        const user = AuthService.getCurrentUser();

        // --- 🛒 Marketplace Visibility Logic ---
        // Hide marketplace links if no user is logged in
        const marketplaceLinks = document.querySelectorAll('a[href*="aura-shop.html"]');
        marketplaceLinks.forEach(link => {
            const navItem = link.closest('.nav-item');
            if (user && (user.role === 'customer' || user.role === 'admin')) {
                if (navItem) navItem.style.display = 'block';
                else link.style.display = 'inline-block';
            } else {
                if (navItem) navItem.style.display = 'none';
                else link.style.display = 'none';
            }
        });

        if (!container) return;

        let desktopHtml = '';
        let mobileHtml = '';

        if (user) {
            const isAdmin = await AuthService.hasPermission('access_admin_dashboard');
            const isEmployee = ['employee', 'cleaning_staff', 'team_lead', 'accounting'].includes(user.role);

            let label = 'Dateien';
            let link = 'files.html';
            if (isAdmin) { label = 'Admin Dashboard'; link = '/legacy/admin_dashboard.html'; }
            else if (isEmployee) { label = 'Mitarbeiter Portal'; link = '/portal/employee_dashboard.html'; }
            else if (user.role === 'customer') { label = 'Kunden Portal'; link = '/portal/customer_dashboard.html'; }

            desktopHtml = `
                <div class="auth-buttons-group">
                    <a href="${link}" class="btn btn-secondary btn-compact">${label}</a>
                    <button onclick="AuthService.logout()" class="btn btn-secondary btn-compact" style="border:none;">Logout</button>
                </div>
            `;
            mobileHtml = `
                <div class="mobile-auth-divider"></div>
                <a href="${link}" class="mobile-auth-link">${label}</a>
                <a href="#" onclick="AuthService.logout(); return false;" class="mobile-auth-link logout">Logout</a>
            `;
        } else {
            const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
            if (isIndex) {
                desktopHtml = `
                    <div class="auth-buttons-group">
                        <a href="customer_login.html" class="btn btn-primary btn-compact">Kunden Portal</a>
                        <a href="login.html" class="btn btn-secondary btn-compact">Mitarbeiter Login</a>
                    </div>
                `;
                mobileHtml = `
                    <div class="mobile-auth-divider"></div>
                    <a href="customer_login.html" class="mobile-auth-link">Kunden Portal</a>
                    <a href="login.html" class="mobile-auth-link">Mitarbeiter Login</a>
                `;
            } else {
                desktopHtml = `
                    <div class="auth-buttons-group">
                        <a href="customer_login.html" class="btn btn-primary btn-compact">Login</a>
                    </div>
                `;
                mobileHtml = `
                    <div class="mobile-auth-divider"></div>
                    <a href="customer_login.html" class="mobile-auth-link">Login</a>
                `;
            }
        }

        container.innerHTML = desktopHtml;

        // Clean up any existing mobile auth links to prevent duplicates
        const existingAuth = mobileNav ? mobileNav.querySelector('.mobile-auth-links') : null;
        if (existingAuth) {
            existingAuth.remove();
        }

        if (mobileNav) {
            const authDiv = document.createElement('div');
            authDiv.className = 'mobile-auth-links';
            authDiv.innerHTML = mobileHtml;
            mobileNav.appendChild(authDiv);
        }
    }
};

// Auto-init UI
document.addEventListener('DOMContentLoaded', () => {
    AuthService.updateHeaderUI();
});
