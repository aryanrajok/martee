# Cartee

> **Non-custodial crypto payment gateway for WooCommerce & Shopify — with AI fraud detection and merchant analytics, powered by BNB Smart Chain.**

Cartee lets merchants accept BEP-20 token payments on their existing stores without writing a single line of code. Customers connect their wallet, approve the transfer, and the order is automatically marked as paid — no middleman, no API keys holding funds.

Built with Next.js 15, Prisma, RainbowKit, and Ethers.js. Currently running on **BNB Testnet** — do not use with real money.

---

## 🔗 Live Links

| | |
|---|---|
| **Dashboard** | https://cartee-dashboard.vercel.app |
| **Test Store** | https://limegreen-parrot-662804.hostingersite.com (WooCommerce) |
| **Token Contract (BSC Testnet)** | [`0xA22985Ce784dfe6298EAB97946eE9d5d5796419a`](https://testnet.bscscan.com/address/0xA22985Ce784dfe6298EAB97946eE9d5d5796419a) |
| **Token Faucet** | https://cartee-dashboard.vercel.app/faucet |

---

## 🧩 What It Does

### For Merchants
1. Go to the dashboard and connect your wallet
2. Copy your API key
3. Install the WooCommerce plugin **or** configure the Shopify webhook
4. Paste your API key in the plugin/webhook settings
5. Done — your store now accepts `tBNBP` crypto payments

### For Customers
1. Add items to cart and proceed to checkout
2. Select **"Crypto Token Payment"**
3. Connect wallet (MetaMask, WalletConnect, etc.)
4. Approve token transfer on BNB Testnet
5. Order is confirmed automatically — no page refresh needed

---

## 🤖 AI Features

### Fraud Detection
Every transaction is automatically scored for risk on a scale of 0–100:

| Score | Level | Action |
|---|---|---|
| 0–20 | 🟢 LOW | Safe to fulfil |
| 21–45 | 🟡 MEDIUM | Manual review recommended |
| 46–70 | 🔴 HIGH | Hold order |
| 71–100 | ⛔ CRITICAL | Block & flag |

Signals analysed: wallet age, transaction frequency, amount anomalies, repeat customer patterns.

Merchants can also run a **Live Fraud Check** — enter any wallet address + amount and get an instant AI risk score before processing.

### Analytics & Predictions
- 14-day revenue trend chart
- 4-day AI revenue forecast
- KPIs: total revenue, conversion rate, avg order value, unique & repeat customers
- Revenue breakdown by channel (Direct / WooCommerce / Shopify)
- Top products by revenue
- Peak payment hour detection
- Actionable AI insights (e.g. drop-off warnings, growth signals)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Customer Browser                      │
│   WooCommerce / Shopify Checkout → Cartee Pay Page      │
│   RainbowKit Wallet Connect → BNB Testnet Transfer      │
└───────────────────────┬─────────────────────────────────┘
                        │ on-chain token transfer
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Blockchain Listener (Ethers.js)             │
│   Watches tBNBP Transfer events via BSC Testnet WSS     │
│   Matches tx → invoice → updates order status           │
└───────────────────────┬─────────────────────────────────┘
                        │ POST /api/orders/update-status
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js Backend (Vercel)                   │
│   API routes, Prisma ORM, PostgreSQL                    │
│   AI fraud scoring, analytics, revenue prediction       │
└───────────────────────┬─────────────────────────────────┘
                        │ webhook / REST API
                        ▼
┌──────────────────────────────────────────┐
│   WooCommerce Plugin  │  Shopify Webhook │
│   (marks order PAID)  │  (marks paid)   │
└──────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS |
| Wallet | RainbowKit, wagmi, viem |
| Blockchain | Ethers.js, BNB Smart Chain Testnet (Chain ID: 97) |
| Smart Contract | BEP-20 token (Solidity, deployed via Hardhat) |
| Backend | Next.js API Routes |
| Database | Prisma ORM + PostgreSQL (Docker / Supabase) |
| WooCommerce | Custom PHP payment gateway plugin |
| Shopify | Webhook-based integration |
| Infra | Vercel (frontend), Railway (blockchain listener) |

---

## 🪙 Token Contract

**TestBNBToken (`tBNBP`)** — deployed on BNB Smart Chain Testnet

| | |
|---|---|
| **Address** | `0xA22985Ce784dfe6298EAB97946eE9d5d5796419a` |
| **Symbol** | `tBNBP` |
| **Decimals** | 18 |
| **Network** | BNB Testnet (Chain ID: 97) |
| **BSCScan** | https://testnet.bscscan.com/address/0xA22985Ce784dfe6298EAB97946eE9d5d5796419a |

**Features:**
- Public minting: 1,000,000 tokens per mint (1 hour cooldown per address)
- Owner mint: no limit (for testing)
- Standard BEP-20 (transfer, approve, allowance)

Source: `/contracts/TestBNBToken.sol`

### Get Test Tokens
1. Get test BNB from the [BNB Faucet](https://testnet.bnbchain.org/faucet-smart)
2. Visit https://cartee-dashboard.vercel.app/faucet
3. Connect wallet, click **Mint Tokens** → receive 1,000,000 tBNBP

---

## ⚙️ Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or Supabase / Docker)
- MetaMask wallet on BNB Smart Chain Testnet
- Test BNB for gas

### Installation

```bash
git clone https://github.com/rizwanmoulvi/cartee-dashboard.git
cd cartee-dashboard
npm install
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# BNB Testnet Token
MNEE_TOKEN_ADDRESS="0xA22985Ce784dfe6298EAB97946eE9d5d5796419a"
NEXT_PUBLIC_MNEE_TOKEN_ADDRESS="0xA22985Ce784dfe6298EAB97946eE9d5d5796419a"

# BNB Testnet RPC
ETHEREUM_RPC_WSS="wss://bsc-testnet.publicnode.com"
ETHEREUM_RPC_HTTP="https://data-seed-prebsc-1-s1.binance.org:8545"
NEXT_PUBLIC_RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545"

# Network
NETWORK_NAME="bsc-testnet"
CHAIN_ID="97"
MIN_CONFIRMATIONS="3"

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_project_id"

# WooCommerce (optional)
WOOCOMMERCE_CONSUMER_KEY="ck_..."
WOOCOMMERCE_CONSUMER_SECRET="cs_..."
WOOCOMMERCE_URL="https://your-store.com"
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🛒 WooCommerce Plugin

Install in 3 steps:
1. Download `mnee-woocommerce-gateway-v6-fixed.zip` from `/woocommerce-plugin`
2. Upload via **WordPress → Plugins → Add New → Upload Plugin**
3. Activate, then go to **WooCommerce → Settings → Payments → Crypto Token**
4. Enter your Cartee API key and click **Save**

---

## 🛍️ Shopify Integration

Shopify doesn't support custom payment plugins, so Cartee uses webhooks:

1. Create a custom app in the Shopify Dev Dashboard
2. Grant `read_orders` and `write_orders` scopes
3. Get your access token
4. Go to **Cartee Dashboard → Shopify tab** and enter store details
5. Register webhook: `https://cartee-dashboard.vercel.app/api/webhooks/shopify?apiKey=YOUR_KEY`
6. Add **"Crypto Token Payment"** as a manual payment method in Shopify

---

## 🔗 Blockchain Listener

Monitors BNB Testnet for `tBNBP` token transfers and auto-updates order status.

**Run locally:**
```bash
npx ts-node services/blockchain-listener.ts
```

**Deploy to Railway:**
```bash
railway init
railway up
```

Use the same `.env` variables as above.

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/merchants/auth` | POST | Create or retrieve merchant account |
| `/api/merchants/invoices` | POST | Create a payment invoice |
| `/api/orders/update-status` | POST | Update order status after payment |
| `/api/webhooks/woocommerce` | POST | Receive WooCommerce order events |
| `/api/webhooks/shopify` | POST | Receive Shopify order events |
| `/api/ai/analytics` | GET | Merchant analytics + AI predictions |
| `/api/ai/fraud-score` | GET/POST | Fraud risk scoring for orders/wallets |

---

## 📁 Project Structure

```
├── src/app/
│   ├── dashboard/        # Merchant dashboard
│   ├── pay/              # Customer payment page
│   ├── faucet/           # Test token faucet
│   ├── ai/               # AI analytics & fraud detection UI
│   └── api/              # All API routes
├── services/
│   └── blockchain-listener.ts   # On-chain event watcher
├── contracts/
│   └── TestBNBToken.sol          # BEP-20 test token
├── prisma/               # Database schema & migrations
└── woocommerce-plugin/   # PHP WooCommerce gateway plugin
```

---

## ⚠️ Known Limitations

- Blockchain listener must run as a separate process (not on Vercel serverless)
- Shopify doesn't auto-show the payment link — requires order status page customisation
- Public RPC nodes may rate-limit under heavy load — use Alchemy/QuickNode in production
- Testnet only — **do not use with real funds**

---

## 🤝 Contributing

PRs welcome. This is a testnet/hackathon project — feel free to experiment.

---

## 📄 License

MIT

---

## 👤 Contact

Built by [@rizwanmoulvi](https://github.com/rizwanmoulvi)

Issues: https://github.com/rizwanmoulvi/cartee-dashboard/issues
