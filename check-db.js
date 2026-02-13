const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrders() {
  try {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        status: true,
        refundTransferHash: true,
        refundedAt: true,
        productName: true,
        totalAmount: true,
        merchantWallet: true,
        expiresAt: true,
        type: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log('Recent orders in database:');
    console.log(JSON.stringify(orders, null, 2));
    
    // Check if any orders have REFUNDED status
    const refundedOrders = orders.filter(o => o.status === 'REFUNDED');
    console.log(`\nFound ${refundedOrders.length} refunded orders`);
    
    if (refundedOrders.length > 0) {
      console.log('Refunded orders:', refundedOrders);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();