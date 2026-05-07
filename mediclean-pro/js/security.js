// 🤖 SYSTEM_NOTE: This file is managed by the AI Project Protocol. ALL changes MUST be documented in .agent/PERSISTENCE.md. Read that file first!
// MediClean Pro - Global Security & Content Protection
(function () {
    // 1. Disable Right Click (Entire Document)
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    }, false);

    // 2. Disable Developer Tools Shortcuts (TEMPORARILY DISABLED FOR DEBUGGING)
    /*
    document.addEventListener('keydown', (e) => {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.ctrlKey && e.key === 'u')) {
            e.preventDefault();
            return false;
        }
    }, false);
    */

    // 3. Disable Drag & Drop for Images (Prevent save as)
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    }, false);

    console.log("Security Layer Active: Content protection initialized (F12 allowed).");
})();
