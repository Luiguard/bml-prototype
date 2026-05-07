// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
/**
 * File System - Remote API Integration
 * [SYSTEM_NOTE: Architectural context and milestones for this project are maintained in .agent/PERSISTENCE.md. Maintaining this persistence file is ESSENTIAL.]
 * FileService - Central File & Folder Management
 * Handles encryption, upload, download, and structure syncing.
 * Synchronizes with Backend API (server/index.js).
 */

const FS_KEY = 'aura_filesystem_cache';

const FileService = {
    _cache: {
        folders: [],
        files: [],
        bookings: [],
        requests: [] // Client side requests/permissions cache
    },

    // --- Core API Helpers ---
    apiCall: async (action, payload = null, method = 'POST') => {
        // Delegate to AuthService which is already configured for V3 Node API
        if (typeof AuthService === 'undefined' || !AuthService._apiCall) {
            console.error("AuthService not found!");
            return { success: false, message: 'Auth Service missing' };
        }
        return await AuthService._apiCall(action, payload, method);
    },

    // --- Initialization & Sync ---
    initFS: async () => {
        console.log("Initializing FS...");
        await FileService.sync();
    },

    sync: async () => {
        const res = await FileService.apiCall('sync', null, 'GET');
        if (res && res.success) {
            FileService._cache.files = res.files || [];
            FileService._cache.folders = res.folders || [];
        }

        const bookRes = await FileService.apiCall('get_bookings', null, 'GET');
        if (bookRes && bookRes.success) {
            FileService._cache.bookings = bookRes.bookings || [];
            localStorage.setItem('aura_bookings', JSON.stringify(bookRes.bookings));
        }

        // Trigger UI update if function exists
        if (typeof renderFolders === 'function') renderFolders();
        if (typeof renderFiles === 'function') renderFiles();
        if (typeof renderAdminFolders === 'function') renderAdminFolders();
        if (typeof renderBooking === 'function') {
            const container = document.getElementById('dashboard-content');
            if (container && container.getAttribute('data-active-section') === 'booking') {
                renderBooking(container);
            }
        }
    },

    getData: () => {
        return {
            folders: FileService._cache.folders,
            files: FileService._cache.files,
            bookings: FileService._cache.bookings,
            requests: []
        };
    },

    // --- Folders ---
    getFolders: async (userId, parentId = null) => {
        // userId arg is redundant as API filters for us, but kept for signature comp.
        const folders = FileService._cache.folders;
        const user = AuthService.getCurrentUser();
        const userKey = (user && user.apiKey) ? user.apiKey : (user ? user.id : 'default');

        const filtered = folders.filter(f => f.parentId === parentId);

        return Promise.all(filtered.map(async folder => {
            // Check decryption
            let name = folder.name;
            // Try decrypt if encrypted
            if (name.startsWith('SEC_V2:') || name.startsWith('SEC_V3:') || name.startsWith('ENC_V1:')) {
                name = await FileService._decrypt(name, userKey);
            }
            return { ...folder, name, status: 'access' };
        }));
    },

    createFolder: async (name, type, userId, parentId = null) => {
        const user = AuthService.getCurrentUser();
        const userKey = (user && user.apiKey) ? user.apiKey : (user ? user.id : 'default');

        const newFolder = {
            id: 'fold_' + Date.now(),
            name: await FileService._encrypt(name, userKey),
            type,
            ownerId: userId,
            parentId: parentId
        };

        const res = await FileService.apiCall('upsert_folder', newFolder);
        if (res.success) {
            await FileService.sync();
            return { success: true, folder: newFolder };
        }
        return res;
    },

    deleteFolder: async (id, userId) => {
        const res = await FileService.apiCall('delete_folder', { id }, 'GET');
        if (res.success) {
            await FileService.sync();
            return { success: true };
        }
        return res;
    },

    // --- Files ---
    getFiles: async (folderId, userId) => {
        const files = FileService._cache.files.filter(f => f.folderId === folderId);
        const user = AuthService.getCurrentUser();
        const userKey = (user && user.apiKey) ? user.apiKey : (user ? user.id : 'default');

        return Promise.all(files.map(async f => {
            // Lazy-download content if it's missing but server has it
            if (!f.content && f.hasContent) {
                console.log(`[FS] Lazy-downloading file content for ${f.name}...`);
                const res = await FileService.apiCall('download', { fileId: f.id }, 'GET');
                if (res.success && res.content) {
                    f.content = res.content; // Cache it in memory
                }
            }

            return {
                ...f,
                data: f.content ? await FileService._decrypt(f.content, userKey) : '[Inhalt wird geladen...]'
            };
        }));
    },

    getFilesForUser: async (userId) => {
        const files = FileService._cache.files;
        const user = AuthService.getCurrentUser();
        const userKey = (user && user.apiKey) ? user.apiKey : (user ? user.id : 'default');

        return Promise.all(files.map(async f => {
            if (!f.content && f.hasContent) {
                const res = await FileService.apiCall('download', { fileId: f.id }, 'GET');
                if (res.success && res.content) f.content = res.content;
            }
            return {
                ...f,
                data: f.content ? await FileService._decrypt(f.content, userKey) : null
            };
        }));
    },

    uploadFile: async (folderId, fileObj, fileData64, userId) => {
        const user = AuthService.getCurrentUser();
        const userKey = (user && user.apiKey) ? user.apiKey : (user ? user.id : 'default');

        const encryptedData = await FileService._encrypt(fileData64, userKey);

        const payload = {
            name: fileObj.name,
            content: encryptedData,
            folderId: folderId
        };

        const res = await FileService.apiCall('upload', payload);
        if (res.success) {
            await FileService.sync();
            return { success: true };
        }
        return res;
    },

    deleteFile: async (id, userId, isAdmin) => {
        const res = await FileService.apiCall('delete_file', { id }, 'GET');
        if (res.success) {
            await FileService.sync();
            return { success: true };
        }
        return res;
    },

    lockFile: async (id) => {
        const res = await FileService.apiCall('lock_file', { id }, 'GET');
        if (res.success) await FileService.sync();
        return res;
    },

    unlockFile: async (id) => {
        const res = await FileService.apiCall('unlock_file', { id }, 'GET');
        if (res.success) await FileService.sync();
        return res;
    },

    // --- Encryption ---
    // --- Encryption (WebCrypto AES-256-GCM) ---
    _helpers: {
        strToBuf: (str) => new TextEncoder().encode(str),
        bufToStr: (buf) => new TextDecoder().decode(buf),
        base64ToBuf: (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
        bufToBase64: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
        deriveKey: async (secret) => {
            const enc = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw", enc.encode(secret), { name: "PBKDF2" }, false, ["deriveKey"]
            );
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(secret));
            return window.crypto.subtle.importKey(
                "raw", hashBuffer, "AES-GCM", false, ["encrypt", "decrypt"]
            );
        }
    },

    _encrypt: async (data, keyStr) => {
        try {
            const key = await FileService._helpers.deriveKey(keyStr);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedData = FileService._helpers.strToBuf(data);

            const encryptedContent = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, key, encodedData
            );

            // WebCrypto returns Ciphertext + Tag (appended).
            // Node format: SEC_V3:IV:Content+Tag
            const ivB64 = FileService._helpers.bufToBase64(iv);
            const contentB64 = FileService._helpers.bufToBase64(encryptedContent);
            return `SEC_V3:${ivB64}:${contentB64}`;
        } catch (e) { console.error("Encrypt Error", e); return data; }
    },

    _decrypt: async (encryptedData, keyStr) => {
        if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;

        if (encryptedData.startsWith('SEC_V3:')) {
            try {
                const parts = encryptedData.split(':');
                if (parts.length !== 3) return '[Corrupt]';

                const iv = FileService._helpers.base64ToBuf(parts[1]);
                const content = FileService._helpers.base64ToBuf(parts[2]);
                const key = await FileService._helpers.deriveKey(keyStr);

                try {
                    const decryptedParams = await window.crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: iv }, key, content
                    );
                    return FileService._helpers.bufToStr(decryptedParams);
                } catch (err) {
                    // Fallback to 'default' key if it wasn't already the key
                    if (keyStr !== 'default') {
                        const defaultKey = await FileService._helpers.deriveKey('default');
                        try {
                            const decryptedParams = await window.crypto.subtle.decrypt(
                                { name: "AES-GCM", iv: iv }, defaultKey, content
                            );
                            return FileService._helpers.bufToStr(decryptedParams);
                        } catch (e2) { }
                    }
                    throw err; // Re-throw if fallback failed
                }
            } catch (e) {
                console.error("Decrypt V3 Error", e);
                return '[Verschlüsselt]';
            }
        }

        // Legacy V2 XOR
        if (encryptedData.startsWith('SEC_V2:')) {
            const xor = (str, k) => {
                let out = '';
                for (let i = 0; i < str.length; i++) {
                    out += String.fromCharCode(str.charCodeAt(i) ^ k.charCodeAt(i % k.length));
                }
                return out;
            };
            try {
                const base64 = encryptedData.replace('SEC_V2:', '');
                const decoded = decodeURIComponent(escape(atob(base64)));
                const decrypted = xor(decoded, keyStr);
                return decodeURIComponent(decrypted);
            } catch (e) { return '[Err V2]'; }
        }

        return encryptedData;
    },

    // --- Bookings (Remote Persistence) ---
    createBooking: async (userId, date, type, notes) => {
        const id = 'bk_' + Date.now();
        const res = await FileService.apiCall('save_booking', { id, date, type, notes });
        if (res.success) {
            await FileService.sync();
            return { success: true };
        }
        return res;
    },
    getBookings: (userId = null) => {
        const bookings = FileService._cache.bookings;
        if (userId) return bookings.filter(b => b.userId == userId); // Weak equality for ID comparison
        return bookings;
    },
    updateBookingStatus: async (id, status) => {
        const res = await FileService.apiCall('update_booking_status', { id, status });
        if (res.success) await FileService.sync();
        return res;
    },
    hasAvailableSlots: (date) => {
        // Simplified check
        return true;
    },
    getAvailableTimeSlots: (date) => {
        return ["09:00", "09:30", "10:00", "11:00", "13:00", "14:00", "15:00"];
    },

    // --- Permission Stubs (Handled by Server now) ---
    canManageAccess: () => false, // Only admin via backend
    getFolderUsers: () => [],
    grantPermission: async () => ({ success: false, message: "Use Admin Panel" }),
    revokePermission: async () => ({ success: false, message: "Use Admin Panel" }),
    updateFolderRoles: async () => ({ success: false }),
    requestAccess: async () => ({ success: false, message: "Contact Admin" }),
};

// Auto Init
document.addEventListener('DOMContentLoaded', () => {
    if (AuthService.getCurrentUser()) {
        FileService.initFS();
    }
});
