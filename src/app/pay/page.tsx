import PaymentClient from './PaymentClient';
import { prisma } from '@/lib/prisma';

interface PaymentPageProps {
  searchParams: Promise<{
    amount?: string;
    currency?: string;
    merchant?: string;
    product?: string;
    orderId?: string;
    description?: string;
    lang?: string;
  }>;
}

// Fetch payment data from database or create new order
async function fetchPaymentData(params: Awaited<PaymentPageProps['searchParams']>) {
  // If orderId is provided, try to fetch from database
  if (params.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId }
    });

    // If order exists, check if it's expired first
    if (order) {
      // Check if direct invoice has expired
      if (order.type === 'DIRECT' && order.expiresAt && new Date() > order.expiresAt && order.status === 'PENDING') {
        // Mark as expired in database
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' }
        });
        // Update local order object
        order.status = 'EXPIRED';
      }

      // If it's a WooCommerce order, fetch the merchant's site URL
      let wooCommerceSiteURL: string | undefined;
      if (order.type === 'WOOCOMMERCE' && order.merchantWallet) {
        const merchant = await prisma.merchant.findUnique({
          where: { walletAddress: order.merchantWallet },
          select: { wooCommerceSiteURL: true }
        });
        wooCommerceSiteURL = merchant?.wooCommerceSiteURL || undefined;
      }

      // Add (Shopify) suffix if it's a Shopify order
      const merchantDisplay = order.type === 'SHOPIFY' 
        ? `${order.merchantName} (Shopify)`
        : order.merchantName;
      
      return {
        amount: order.totalAmount,
        currency: order.currency,
        merchant: merchantDisplay,
        product: order.productName,
        orderId: order.id,
        description: order.orderConfirmation || '',
        status: order.status,
        transferHash: order.transferHash,
        customerWallet: order.customerWallet,
        merchantWallet: order.merchantWallet,
        type: order.type as 'SHOPIFY' | 'WOOCOMMERCE' | 'DIRECT',
        storeName: order.merchantName, // Use original merchant name without suffix
        expiresAt: order.expiresAt?.toISOString(),
        wooCommerceSiteURL,
      };
    }
  }

  // If no orderId is provided or orderId was provided but no order found, return null to show error
  return null;
}

// Error component for invalid invoices
function InvalidInvoiceError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
        <p className="text-gray-600 mb-6">
          We could not find this invoice or this is an invalid invoice. The invoice may have expired or been cancelled.
        </p>
        <div className="space-y-3">
          <a
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Invoice on Dashboard
          </a>
          <a
            href="/"
            className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Back to Homepage
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function PaymentPage({ searchParams }: PaymentPageProps) {
  const resolvedSearchParams = await searchParams;
  const paymentData = await fetchPaymentData(resolvedSearchParams);

  // Show error page if invoice not found
  if (!paymentData) {
    return <InvalidInvoiceError />;
  }

  return <PaymentClient paymentData={paymentData} />;
}

export async function generateMetadata({ searchParams }: PaymentPageProps) {
  const resolvedSearchParams = await searchParams;
  const paymentData = await fetchPaymentData(resolvedSearchParams);
  
  if (!paymentData) {
    return {
      title: 'Invoice Not Found - Cartee',
      description: 'The requested invoice could not be found or is invalid.',
    };
  }
  
  return {
    title: `Pay ${paymentData.amount} ${paymentData.currency} - ${paymentData.merchant}`,
    description: `Complete your payment of ${paymentData.amount} ${paymentData.currency} to ${paymentData.merchant} for ${paymentData.product}`,
  };
}