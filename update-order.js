const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateOrder() {
  const order = await prisma.order.update({
    where: { id: 'shopify_6054451904665' },
    data: { orderConfirmation: 'TEST-CONFIRM-123' }
  });
  
  console.log('Order updated:', order);
  
  await prisma.$disconnect();
}

updateOrder().catch(console.error);