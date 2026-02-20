// ── content.js ───────────────────────────────────────────────────────────────
// Injected into every page. Detects WooCommerce / Shopify checkouts and
// injects a "Pay with Cartee" button.

(function () {
  'use strict';

  const CARTEE_URL = 'http://localhost:3000';
  const BUTTON_ID = 'cartee-pay-btn-injected';

  // Avoid double-injection
  if (document.getElementById(BUTTON_ID)) return;

  // ── Detect checkout context ──────────────────────────────────────────────
  const isWooCheckout = !!(
    document.querySelector('form.woocommerce-checkout') ||
    document.querySelector('#order_review') ||
    document.querySelector('.woocommerce-cart-form') ||
    document.body?.classList.contains('woocommerce-checkout')
  );

  const isShopifyCheckout = !!(
    document.querySelector('form[action*="/checkouts"]') ||
    document.querySelector('.section--payment-method') ||
    window.Shopify
  );

  if (!isWooCheckout && !isShopifyCheckout) return;

  // ── Build the button ─────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.id = BUTTON_ID;
  wrapper.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  wrapper.innerHTML = `
    <div id="cartee-badge" style="
      background: #ffffff;
      border-radius: 12px;
      padding: 14px 22px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      user-select: none;
    "
    onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)'"
    onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)'"
    onmousedown="this.style.transform='translateY(0) scale(0.97)'"
    onmouseup="this.style.transform='translateY(-2px) scale(1)'"
    >
      <!-- Cartee lightning bolt icon -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
          </linearGradient>
        </defs>
        <polygon points="13.5,2 7,13 11.5,13 10,22 17.5,11 13,11" fill="url(#cg)"/>
      </svg>

      <!-- Label -->
      <span style="
        color: #111827;
        font-weight: 650;
        font-size: 15px;
        letter-spacing: -0.2px;
        white-space: nowrap;
      ">Pay with Cartee</span>
    </div>

    <!-- Dismiss -->
    <div id="cartee-dismiss" style="
      position: absolute;
      top: -7px; right: -7px;
      width: 18px; height: 18px;
      background: #e5e7eb;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 10px;
      color: #6b7280;
      line-height: 1;
    ">✕</div>
  `;

  // ── Scrape checkout details ────────────────────────────────────────────────
  function scrapeCheckoutDetails() {
    const details = {
      productName: 'Order',
      totalAmount: 0,
      storeName: '',
      currency: 'MNEE',
    };

    // Get store name
    details.storeName = document.querySelector('meta[property="og:site_name"]')?.content
      || document.querySelector('.site-title a, .logo a, header a[href="/"]')?.textContent?.trim()
      || document.title.split(/[|–—-]/).pop()?.trim()
      || window.location.hostname;

    if (isWooCheckout) {
      // WooCommerce: scrape order total
      const totalEl = document.querySelector('.order-total .woocommerce-Price-amount bdi, .order-total .amount, .cart-subtotal .amount, .order-total td .amount');
      if (totalEl) {
        const raw = totalEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
        details.totalAmount = parseFloat(raw) || 0;
      }

      // WooCommerce: scrape product names
      const productEls = document.querySelectorAll('.woocommerce-checkout-review-order-table .product-name, .cart_item .product-name, .woocommerce-cart-form .product-name a');
      if (productEls.length) {
        details.productName = Array.from(productEls).map(el => el.textContent.trim().replace(/\s*×\s*\d+$/, '')).join(', ');
      }
    } else if (isShopifyCheckout) {
      // Shopify: scrape order total
      const totalEl = document.querySelector('.payment-due__price, .total-line--total .total-line__price, [data-checkout-payment-due-target]');
      if (totalEl) {
        const raw = totalEl.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
        details.totalAmount = parseFloat(raw) || 0;
      }

      // Shopify: scrape product names
      const productEls = document.querySelectorAll('.product__description__name, .product-thumbnail__title');
      if (productEls.length) {
        details.productName = Array.from(productEls).map(el => el.textContent.trim()).join(', ');
      }
    }

    // Fallback: try to find any visible total if we didn't get one
    if (!details.totalAmount) {
      const allPrices = document.querySelectorAll('[class*="total"] [class*="amount"], [class*="total"] [class*="price"]');
      for (const el of allPrices) {
        const raw = el.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
        const val = parseFloat(raw);
        if (val > 0) {
          details.totalAmount = val;
          break;
        }
      }
    }

    return details;
  }

  // ── Click handler ─────────────────────────────────────────────────────────
  wrapper.querySelector('#cartee-badge').addEventListener('click', async () => {
    const badge = wrapper.querySelector('#cartee-badge');
    const label = badge.querySelector('span:last-child');
    const originalText = label.textContent;

    // Show loading state
    label.textContent = 'Creating invoice…';
    badge.style.pointerEvents = 'none';
    badge.style.opacity = '0.7';

    try {
      const details = scrapeCheckoutDetails();
      console.log('Cartee: Checkout details scraped:', details);

      if (!details.totalAmount || details.totalAmount <= 0) {
        // If we can't scrape the amount, redirect to dashboard to create manually
        label.textContent = 'Could not detect order total';
        badge.style.opacity = '1';
        setTimeout(() => {
          window.open(CARTEE_URL + '/dashboard', '_blank', 'noopener');
          label.textContent = originalText;
          badge.style.pointerEvents = 'auto';
        }, 1500);
        return;
      }

      // Get stored wallet/API key from extension storage
      let apiKey = '';
      let merchantWallet = '';
      try {
        const stored = await chrome.storage.local.get(['apiKey', 'wallet']);
        apiKey = stored.apiKey || '';
        merchantWallet = stored.wallet || '';
        console.log('Cartee: Stored wallet:', merchantWallet ? merchantWallet.slice(0, 10) + '...' : '(none)');
      } catch (e) {
        console.warn('Cartee: Extension storage not available:', e);
      }

      if (!apiKey && !merchantWallet) {
        label.textContent = 'Set wallet in extension popup first';
        badge.style.opacity = '1';
        setTimeout(() => {
          label.textContent = originalText;
          badge.style.pointerEvents = 'auto';
        }, 2500);
        return;
      }

      // Build the request headers
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const reqBody = {
        productName: details.productName,
        totalAmount: details.totalAmount,
        currency: details.currency,
        description: 'Payment from ' + details.storeName + ' via Cartee extension',
        expiresInHours: 24,
      };

      // Add merchant wallet if no API key
      if (!apiKey && merchantWallet) {
        reqBody._merchantWallet = merchantWallet;
      }

      const apiUrl = CARTEE_URL + '/api/merchants/invoices';
      console.log('Cartee: Creating invoice via background worker at', apiUrl);

      // Route the API call through the background service worker.
      // Content scripts run on the checkout page origin and are subject
      // to CORS — the background worker has host_permissions and is exempt.
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'api-request',
            url: apiUrl,
            method: 'POST',
            headers: headers,
            body: reqBody,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      console.log('Cartee: Background worker response:', result);

      if (!result || !result.ok) {
        const errMsg = result?.error || result?.data?.error || 'Failed to create invoice (HTTP ' + (result?.status || '?') + ')';
        throw new Error(errMsg);
      }

      const invoice = result.data;
      console.log('Cartee: Invoice created successfully:', invoice.id);

      // Redirect to pay page with orderId
      window.open(CARTEE_URL + '/pay?orderId=' + encodeURIComponent(invoice.id), '_blank', 'noopener');

      // Restore button
      label.textContent = originalText;
      badge.style.pointerEvents = 'auto';
      badge.style.opacity = '1';

    } catch (err) {
      console.error('Cartee: Error creating invoice:', err);
      const msg = err.message && err.message.length < 50 ? err.message : 'Error – try again';
      label.textContent = msg;
      badge.style.opacity = '1';
      setTimeout(() => {
        label.textContent = originalText;
        badge.style.pointerEvents = 'auto';
      }, 3000);
    }
  });

  // ── Dismiss ───────────────────────────────────────────────────────────────
  wrapper.querySelector('#cartee-dismiss').addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.remove();
  });

  document.body.appendChild(wrapper);

  // ── Animate in ────────────────────────────────────────────────────────────
  const badge = wrapper.querySelector('#cartee-badge');
  badge.style.opacity = '0';
  badge.style.transform = 'translateY(16px)';
  setTimeout(() => {
    badge.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    badge.style.opacity = '1';
    badge.style.transform = 'translateY(0)';
  }, 700);

})();
