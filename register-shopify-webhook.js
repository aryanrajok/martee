#!/usr/bin/env node

/**
 * Register Shopify webhook for order creation
 * Run: node register-shopify-webhook.js
 */

require('dotenv').config();

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const API_KEY = 'eda8070fcefc02c5'; // Your API key from dashboard

if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
  console.error('❌ Missing environment variables:');
  console.error('   SHOPIFY_API_ACCESS_TOKEN');
  console.error('   SHOPIFY_STORE_URL');
  process.exit(1);
}

const WEBHOOK_URL = `https://cartee-dashboard.vercel.app/api/webhooks/shopify?apiKey=${API_KEY}`;

async function registerWebhook() {
  try {
    console.log('🔧 Registering Shopify webhook...');
    console.log('📍 Store:', SHOPIFY_STORE_URL);
    console.log('🔗 Webhook URL:', WEBHOOK_URL);
    
    const response = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      },
      body: JSON.stringify({
        webhook: {
          topic: 'orders/create',
          address: WEBHOOK_URL,
          format: 'json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register webhook:', error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Webhook registered successfully!');
    console.log('📦 Webhook details:', JSON.stringify(result.webhook, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

registerWebhook();
