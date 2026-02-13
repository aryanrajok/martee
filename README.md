# Cartee

A cryptocurrency payment gateway for WooCommerce and Shopify that accepts MNEE stablecoin on Ethereum Sepolia testnet.

Built with Next.js, Prisma, and RainbowKit. Currently running on testnet - **do not use with real money**.

## Live Demo

- Dashboard: https://cartee-dashboard.vercel.app
- Test Store: https://limegreen-parrot-662804.hostingersite.com (WooCommerce)

## What it does

Lets merchants accept MNEE token payments on their WooCommerce or Shopify stores. Customers connect their wallet, approve/send tokens, and the order gets marked as paid automatically.

The blockchain listener watches for transfers and updates order status in real-time. No middleman, no API keys to manage customer funds.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Supabase)
- Ethereum wallet with Sepolia ETH
- WooCommerce or Shopify store (optional)

### Installation

```bash
git clone https://github.com/rizwanmoulvi/cartee-dashboard.git
cd cartee-dashboard
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Database
DATABASE_URL="postgresql://..."

# MNEE Token (Sepolia testnet)
MNEE_TOKEN_ADDRESS="0x49F65A3C616Cd9B83DE5615D39e01B49bE14b643"
NEXT_PUBLIC_MNEE_TOKEN_ADDRESS="0x49F65A3C616Cd9B83DE5615D39e01B49bE14b643"

# Ethereum RPC
ETHEREUM_RPC_WSS="wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_ALCHEMY_ID="YOUR_KEY"

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_project_id"

# Network
NETWORK_NAME="sepolia"
MIN_CONFIRMATIONS="1"
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Usage

### For Merchants

1. Go to dashboard and connect your wallet
2. Copy your API key
3. Install the WooCommerce plugin OR configure Shopify webhook
4. Add API key to plugin/webhook settings
5. Done - you can now accept MNEE payments

### For Customers

1. Add items to cart
2. Choose "MNEE Token Payment" at checkout
3. Connect wallet and approve transaction
4. Payment confirmed automatically

## WooCommerce Plugin

The plugin is in `/krw-woocommerce-gateway-plugin`. 

**Install:**
1. Download `mnee-woocommerce-gateway-v6-fixed.zip`
2. Upload to WordPress via Plugins → Add New → Upload
3. Activate plugin
4. Go to WooCommerce → Settings → Payments → MNEE Token
5. Enter your API key and click "Save"
6. Click "Connect" to verify

## Shopify Integration

Shopify doesn't support custom payment plugins, so we use webhooks + manual payment method.

**Setup:**
1. Create custom app in Shopify Dev Dashboard
2. Add `read_orders` and `write_orders` scopes
3. Get access token
4. Configure in Cartee dashboard (Shopify tab)
5. Register webhook: `https://cartee-dashboard.vercel.app/api/webhooks/shopify?apiKey=YOUR_KEY`
6. Add "MNEE Token Payment" as manual payment method in Shopify

Check `register-shopify-webhook.js` for automated webhook registration.

## Blockchain Listener

Monitors the blockchain for MNEE transfers and updates order status.

**Run locally:**
```bash
npm install -D ts-node ethers
npx ts-node services/blockchain-listener.ts
```

**Deploy to Railway:**
```bash
railway init
railway up
```

Add same env variables as above.

## Tech Stack

- Next.js 15 (App Router)
- Prisma (PostgreSQL)
- RainbowKit + wagmi + viem
- Tailwind CSS
- Ethers.js (blockchain listener)

## Token Contract

TestMNEE is deployed on Sepolia at `0x49F65A3C616Cd9B83DE5615D39e01B49bE14b643`
Using this instead of actual MNEE token (`0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`) on ethereum becuase we don't have funds to buy actual token and test

Source: `/contracts/TestMNEE.sol`

Features:
- Public minting (1M tokens per hour cooldown)
- ERC20 standard
- Testnet only

## Get Test Tokens

Use the faucet at https://cartee-dashboard.vercel.app/faucet

You'll need Sepolia ETH first:
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://sepoliafaucet.com

## Project Structure

```
├── src/app/              # Next.js app router
│   ├── dashboard/        # Merchant dashboard
│   ├── pay/             # Payment page
│   ├── faucet/          # Token faucet
│   └── api/             # API routes
├── services/            # Blockchain listener
├── prisma/              # Database schema
└── krw-woocommerce-gateway-plugin/  # WooCommerce plugin
```

## API Endpoints

- `POST /api/merchants/auth` - Create/get merchant account
- `POST /api/merchants/invoices` - Create payment invoice
- `POST /api/orders/update-status` - Update order status
- `POST /api/webhooks/woocommerce` - WooCommerce order webhook
- `POST /api/webhooks/shopify` - Shopify order webhook

## Known Issues

- Alchemy rate limits sometimes cause approve() to fail - wait 30s and retry
- Blockchain listener must run separately (not on Vercel)
- Shopify doesn't show payment link automatically (need order status page customization)

## Contributing

PRs welcome. This is a testnet project so feel free to experiment.

## License

MIT

## Contact

Built by [@rizwanmoulvi](https://github.com/rizwanmoulvi)

Issues: https://github.com/rizwanmoulvi/cartee-dashboard/issues
