// ── popup.js ─────────────────────────────────────────────────────────────────
// Runs inside the extension popup

const CARTEE_URL = 'http://localhost:3000';

// Checkout page signals (WooCommerce + Shopify keywords)
const CHECKOUT_SIGNALS = [
    'checkout', 'cart', 'payment', 'pay', 'order', 'basket', 'purchase'
];

document.addEventListener('DOMContentLoaded', async () => {
    detectCurrentPage();
    loadStats();
    initWalletSetup();
});

// ── Detect whether the active tab looks like a checkout page ──────────────────
async function detectCurrentPage() {
    const urlEl = document.getElementById('current-url');
    const statusEl = document.getElementById('page-status');
    const statusTxt = document.getElementById('page-status-text');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab.url || '';
        const shortUrl = url.replace(/^https?:\/\//, '').substring(0, 55) || '—';
        urlEl.textContent = shortUrl;

        const isCheckout = CHECKOUT_SIGNALS.some(sig => url.toLowerCase().includes(sig));

        if (isCheckout) {
            statusEl.className = 'page-status detected';
            statusTxt.textContent = 'Checkout page detected — Cartee button injected!';
        } else {
            statusEl.className = 'page-status not-detected';
            statusTxt.textContent = 'No checkout detected on this page';
        }
    } catch {
        urlEl.textContent = 'Could not read page URL';
        statusTxt.textContent = 'Permission required';
    }
}

// ── Load merchant stats from Cartee API ──────────────────────────────────────
async function loadStats() {
    const ordersEl = document.getElementById('stat-orders');
    const revenueEl = document.getElementById('stat-revenue');

    try {
        // Pull stored wallet from extension storage (set after first dashboard visit)
        const { wallet } = await chrome.storage.local.get('wallet');
        if (!wallet) return;

        const res = await fetch(`${CARTEE_URL}/api/ai/analytics?wallet=${wallet.toLowerCase()}`);
        if (!res.ok) return;

        const data = await res.json();
        ordersEl.textContent = data.overview?.totalOrders ?? '—';
        revenueEl.textContent = data.overview?.totalRevenue != null
            ? '$' + Number(data.overview.totalRevenue).toFixed(0)
            : '—';
    } catch {
        // Silently fail — stats are optional
    }
}

// ── Wallet Setup ─────────────────────────────────────────────────────────────
async function initWalletSetup() {
    const walletForm = document.getElementById('wallet-form');
    const walletDisplay = document.getElementById('wallet-display');
    const walletAddr = document.getElementById('wallet-addr');
    const walletInput = document.getElementById('wallet-input');
    const walletSave = document.getElementById('wallet-save');
    const walletClear = document.getElementById('wallet-clear');
    const walletStatus = document.getElementById('wallet-status');

    // Load saved wallet
    try {
        const { wallet } = await chrome.storage.local.get('wallet');
        if (wallet) {
            showSavedWallet(wallet);
        }
    } catch { }

    function showSavedWallet(addr) {
        const short = addr.slice(0, 8) + '…' + addr.slice(-6);
        walletAddr.textContent = '✓ ' + short;
        walletForm.style.display = 'none';
        walletDisplay.style.display = 'block';
        walletStatus.textContent = 'Wallet saved — extension can now create invoices';
        walletStatus.style.color = '#10b981';
    }

    // Save wallet
    walletSave.addEventListener('click', async () => {
        const addr = walletInput.value.trim().toLowerCase();
        if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
            walletStatus.textContent = '⚠ Enter a valid 0x… wallet address (42 chars)';
            walletStatus.style.color = '#f59e0b';
            return;
        }

        await chrome.storage.local.set({ wallet: addr });
        showSavedWallet(addr);
    });

    // Clear wallet
    walletClear.addEventListener('click', async () => {
        await chrome.storage.local.remove('wallet');
        walletForm.style.display = 'block';
        walletDisplay.style.display = 'none';
        walletInput.value = '';
        walletStatus.textContent = 'Wallet removed';
        walletStatus.style.color = 'rgba(255,255,255,0.4)';
    });
}
