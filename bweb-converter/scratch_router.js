        // BWEB Data-URL Router: Handles internal navigation across embedded pages
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if (a && a.href && a.href.startsWith('data:text/html')) {
                e.preventDefault();
                const base64 = a.href.split(',')[1];
                if (base64) {
                    try {
                        const html = decodeURIComponent(escape(atob(base64)));
                        document.open();
                        document.write(html);
                        document.close();
                    } catch(err) {
                        console.error('BWEB Router Fehler:', err);
                    }
                }
            }
        });
