// ── background.js (Service Worker) ───────────────────────────────────────────
// Handles extension lifecycle events and proxies API calls for content scripts.
// Background service workers are exempt from CORS, so routing fetch requests
// through here avoids cross-origin issues on checkout pages.

chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        // Open the Cartee dashboard on first install
        chrome.tabs.create({ url: 'http://localhost:3000' });

        // Show a welcome notification
        chrome.notifications?.create('cartee-welcome', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Cartee installed! ⚡',
            message: 'Look for the "Pay with Cartee" button on WooCommerce & Shopify checkout pages.'
        });
    }
});

// ── Message handler ──────────────────────────────────────────────────────────
// Proxies fetch requests from content scripts (which run on the checkout page
// origin and are subject to CORS) through the background service worker
// (which has host_permissions and is NOT subject to CORS).

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ping') {
        sendResponse({ status: 'alive' });
        return true;
    }

    if (message.type === 'api-request') {
        handleApiRequest(message)
            .then(sendResponse)
            .catch(err => sendResponse({ ok: false, error: err.message || 'Unknown error' }));
        return true; // Keep the message channel open for async response
    }

    return true;
});

async function handleApiRequest({ url, method, headers, body }) {
    try {
        const fetchOptions = {
            method: method || 'GET',
            headers: headers || {},
        };

        if (body && method !== 'GET') {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const res = await fetch(url, fetchOptions);
        const data = await res.json().catch(() => ({}));

        return {
            ok: res.ok,
            status: res.status,
            data: data,
        };
    } catch (err) {
        console.error('Cartee background: fetch error:', err);
        return {
            ok: false,
            status: 0,
            error: err.message || 'Network request failed',
        };
    }
}
