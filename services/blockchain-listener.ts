import { ethers } from 'ethers';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const prisma = new PrismaClient();

// MNEE Token Configuration
// Production: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF (Ethereum Mainnet)
// Testing: 0x21dbe1B2FA0068628df10799824eF366A0985416 (Sepolia Testnet - tMNEE)
const MNEE_TOKEN_ADDRESS = process.env.MNEE_TOKEN_ADDRESS || '0x21dbe1B2FA0068628df10799824eF366A0985416';
const ETHEREUM_RPC_WSS = process.env.ETHEREUM_RPC_WSS || 'wss://eth-sepolia.g.alchemy.com/v2/j3uFy79ofZuSWUq1DNeTBKon5SQhbjh2';
const MIN_CONFIRMATIONS = parseInt(process.env.MIN_CONFIRMATIONS || '1');
const NETWORK_NAME = process.env.NETWORK_NAME || 'sepolia';

// ERC-20 ABI for Transfer event
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)'
];

interface PaymentNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Notify WooCommerce that payment has been confirmed
 */
async function notifyWooCommercePayment(
  orderKey: string, 
  transactionId: string, 
  apiKey: string, 
  siteUrl: string
): Promise<PaymentNotificationResult> {
  try {
    console.log(`[WooCommerce] Notifying payment for order ${orderKey}`);
    
    const response = await fetch(`${siteUrl}/wp-admin/admin-ajax.php?action=MNEE_payment_confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        order_key: orderKey,
        transaction_id: transactionId,
        api_key: apiKey
      })
    });

    const result = await response.json();
    console.log('[WooCommerce] Notification result:', result);
    
    return { success: result.success || false };
  } catch (error) {
    console.error('[WooCommerce] Failed to notify:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Mark Shopify order as paid using Admin GraphQL API
 */
async function markShopifyOrderAsPaid(
  adminGraphqlApiId: string,
  shopDomain: string,
  accessToken: string
): Promise<PaymentNotificationResult> {
  try {
    console.log(`[Shopify] Marking order ${adminGraphqlApiId} as paid`);
    
    const mutation = `
      mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          userErrors {
            field
            message
          }
          order {
            id
            displayFinancialStatus
          }
        }
      }
    `;

    const variables = {
      input: {
        id: adminGraphqlApiId
      }
    };

    const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();
    
    if (result.data?.orderMarkAsPaid?.userErrors?.length > 0) {
      console.error('[Shopify] GraphQL errors:', result.data.orderMarkAsPaid.userErrors);
      return { 
        success: false, 
        error: result.data.orderMarkAsPaid.userErrors[0].message 
      };
    }

    console.log('[Shopify] Order marked as paid successfully');
    return { success: true };
  } catch (error) {
    console.error('[Shopify] Failed to mark order as paid:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Process a confirmed payment by updating the order and notifying the platform
 */
async function processConfirmedPayment(
  orderId: string,
  transactionHash: string,
  fromAddress: string,
  amount: string,
  blockNumber: number
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      console.error(`[Processor] Order ${orderId} not found`);
      return;
    }

    if (order.status !== 'PENDING') {
      console.log(`[Processor] Order ${orderId} already processed (status: ${order.status})`);
      return;
    }

    // Update order to PAID status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        transferHash: transactionHash,
        customerWallet: fromAddress.toLowerCase(),
        paidAt: new Date()
      }
    });

    console.log(`[Processor] Order ${orderId} marked as PAID`);

    // Fetch merchant if order has merchantWallet
    let merchant = null;
    if (order.merchantWallet) {
      merchant = await prisma.merchant.findUnique({
        where: { walletAddress: order.merchantWallet }
      });
    }

    // Notify the appropriate platform
    if (order.type === 'WOOCOMMERCE' && order.orderConfirmation) {
      if (!merchant?.wooCommerceSiteURL) {
        console.error(`[Processor] WooCommerce site URL not found for merchant`);
        return;
      }

      await notifyWooCommercePayment(
        order.orderConfirmation,
        transactionHash,
        merchant.apiKey,
        merchant.wooCommerceSiteURL
      );
    } else if (order.type === 'SHOPIFY' && order.adminGraphqlApiId) {
      if (!merchant?.shopifyAccessToken || !merchant?.shopifyShopDomain) {
        console.error(`[Processor] Shopify credentials not found for merchant`);
        return;
      }

      await markShopifyOrderAsPaid(
        order.adminGraphqlApiId,
        merchant.shopifyShopDomain,
        merchant.shopifyAccessToken
      );
    }

    console.log(`[Processor] Payment processing completed for order ${orderId}`);
  } catch (error: any) {
    console.error(`[Processor] Error processing order ${orderId}:`, error);
  }
}

/**
 * Match a blockchain transfer to a pending order
 */
async function matchTransferToOrder(
  toAddress: string,
  amount: string,
  fromAddress: string
): Promise<string | null> {
  try {
    const amountInEther = parseFloat(amount);
    
    // Find pending order matching merchant wallet and amount
    // We use a tolerance of 0.01% to account for any precision issues
    const order = await prisma.order.findFirst({
      where: {
        merchantWallet: toAddress.toLowerCase(),
        status: 'PENDING',
        totalAmount: {
          gte: amountInEther * 0.9999,
          lte: amountInEther * 1.0001
        }
      },
      orderBy: {
        createdAt: 'asc' // Match oldest pending order first
      }
    });

    if (order) {
      console.log(`[Matcher] Matched transfer to order ${order.id}`);
      return order.id;
    }

    console.log(`[Matcher] No matching order found for transfer to ${toAddress} amount ${amount}`);
    return null;
  } catch (error) {
    console.error('[Matcher] Error matching transfer:', error);
    return null;
  }
}

/**
 * Start the blockchain listener service
 */
export async function startBlockchainListener() {
  console.log('='.repeat(80));
  console.log('🚀 Starting MNEE Blockchain Listener Service');
  console.log('='.repeat(80));
  console.log(`Network: ${NETWORK_NAME}`);
  console.log(`Token: ${MNEE_TOKEN_ADDRESS}`);
  console.log(`Min Confirmations: ${MIN_CONFIRMATIONS}`);
  console.log(`RPC: ${ETHEREUM_RPC_WSS.replace(/\/[^/]+$/, '/***')}`);
  console.log('='.repeat(80));

  let provider: ethers.WebSocketProvider;
  let tokenContract: ethers.Contract;
  let isReconnecting = false;

  const setupConnection = async () => {
    try {
      // Create WebSocket provider
      provider = new ethers.WebSocketProvider(ETHEREUM_RPC_WSS);
      
      // Test connection
      const network = await provider.getNetwork();
      console.log(`✅ Connected to network: ${network.name} (chainId: ${network.chainId})`);

      // Create contract instance
      tokenContract = new ethers.Contract(MNEE_TOKEN_ADDRESS, ERC20_ABI, provider);

      // Get token info
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      console.log(`✅ Token: ${symbol} (${decimals} decimals)`);

      // Listen for Transfer events
      tokenContract.on('Transfer', async (from: string, to: string, value: bigint, event: ethers.EventLog) => {
        try {
          const amount = ethers.formatUnits(value, decimals);
          const txHash = event.transactionHash;
          const blockNumber = event.blockNumber;

          console.log('\n' + '='.repeat(80));
          console.log('🔔 New Transfer Event Detected');
          console.log('='.repeat(80));
          console.log(`From: ${from}`);
          console.log(`To: ${to}`);
          console.log(`Amount: ${amount} ${symbol}`);
          console.log(`Tx Hash: ${txHash}`);
          console.log(`Block: ${blockNumber}`);

          // Try to match this transfer to a pending order
          const orderId = await matchTransferToOrder(to, amount, from);

          if (orderId) {
            console.log(`✅ Matched to order: ${orderId}`);
            console.log(`⏳ Waiting for ${MIN_CONFIRMATIONS} confirmations...`);

            // Wait for confirmations
            const receipt = await event.getTransactionReceipt();
            await receipt.confirmations();

            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - blockNumber + 1;

            if (confirmations >= MIN_CONFIRMATIONS) {
              console.log(`✅ ${confirmations} confirmations received`);
              await processConfirmedPayment(orderId, txHash, from, amount, blockNumber);
            } else {
              console.log(`⏳ Only ${confirmations}/${MIN_CONFIRMATIONS} confirmations, waiting...`);
              
              // Set up a listener for additional confirmations
              let confirmedBlock = blockNumber + MIN_CONFIRMATIONS;
              const confirmationListener = async (newBlockNumber: number) => {
                if (newBlockNumber >= confirmedBlock) {
                  console.log(`✅ Confirmation threshold reached for tx ${txHash}`);
                  await processConfirmedPayment(orderId, txHash, from, amount, blockNumber);
                  provider.off('block', confirmationListener);
                }
              };
              
              provider.on('block', confirmationListener);
            }
          } else {
            console.log('ℹ️  No matching order found (might be a different payment)');
          }
          
          console.log('='.repeat(80) + '\n');
        } catch (error) {
          console.error('❌ Error processing Transfer event:', error);
        }
      });

      // Handle provider errors
      provider.on('error', (error) => {
        console.error('❌ Provider error:', error);
        reconnect();
      });

      // Monitor connection with periodic block number checks
      const monitorInterval = setInterval(async () => {
        try {
          await provider.getBlockNumber();
        } catch (error) {
          console.error('❌ Connection check failed:', error);
          clearInterval(monitorInterval);
          reconnect();
        }
      }, 30000); // Check every 30 seconds

      console.log('✅ Listener active - monitoring for MNEE transfers...\n');
    } catch (error) {
      console.error('❌ Failed to setup connection:', error);
      reconnect();
    }
  };

  const reconnect = async () => {
    if (isReconnecting) return;
    isReconnecting = true;

    console.log('🔄 Reconnecting in 5 seconds...');
    
    // Clean up existing connection
    try {
      if (tokenContract) {
        tokenContract.removeAllListeners();
      }
      if (provider) {
        provider.destroy();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }

    setTimeout(async () => {
      isReconnecting = false;
      await setupConnection();
    }, 5000);
  };

  // Initial connection
  await setupConnection();

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
    if (tokenContract) tokenContract.removeAllListeners();
    if (provider) provider.destroy();
    prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️  SIGINT received, shutting down gracefully...');
    if (tokenContract) tokenContract.removeAllListeners();
    if (provider) provider.destroy();
    prisma.$disconnect();
    process.exit(0);
  });
}

// Run the listener if this file is executed directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  startBlockchainListener().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
