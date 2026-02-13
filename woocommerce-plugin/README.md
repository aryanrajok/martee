# MNEE Token Payment Gateway for WooCommerce

A WooCommerce payment gateway for MNEE token payments on Ethereum blockchain via Cartee payment processor.

## Features

- Accept MNEE token payments on Ethereum Sepolia testnet
- Block and classic checkout support
- Wallet redirect functionality
- Refund support
- Real-time payment verification via blockchain

## Installation / Quick Start

1. Download the plugin ZIP file or clone this repository
2. Upload to `/wp-content/plugins/woocommerce-mnee-gateway/`
3. Activate plugin in WordPress admin
4. Go to WooCommerce → Settings → Payments
5. Enable "MNEE Token" payment method
6. Get your API Key from [Cartee Dashboard](https://cartee-dashboard.vercel.app/dashboard)
7. Enter the API Key in plugin settings
8. Click "Save Changes"
9. Click the "Connect" button beside API key input to authenticate with Cartee

## Requirements

- WordPress 5.8+
- WooCommerce 6.0+
- PHP 7.4+
- Customers need MetaMask or compatible Web3 wallet
- Customers need MNEE tokens on Ethereum Sepolia testnet

## Configuration

### API Integration
- **Dashboard URL**: https://cartee-dashboard.vercel.app/dashboard
- **Payment URL**: https://cartee-dashboard.vercel.app/pay
- **Webhook URL**: https://cartee-dashboard.vercel.app/api/webhooks/woocommerce

### Network Details
- **Blockchain**: Ethereum Sepolia Testnet
- **Token**: MNEE (0x21dbe1B2FA0068628df10799824eF366A0985416)
- **Network ID**: 11155111

## How It Works

1. Customer selects MNEE payment at checkout
2. Order is created and sent to Cartee gateway
3. Customer is redirected to Cartee payment page
4. Customer connects wallet and approves MNEE token transfer
5. Payment is verified on blockchain
6. Order status is updated via webhook
7. Customer is redirected back to WooCommerce

## Testing

Get test MNEE tokens from the faucet: https://cartee-dashboard.vercel.app/faucet

## Support

For issues and questions, visit the [GitHub repository](https://github.com/rizwanmoulvi/mnee-woocommerce-gateway)

## License

GPLv2 or later