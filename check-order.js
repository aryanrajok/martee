const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrder() {
  const order = await prisma.order.findUnique({
    where: { id: 'shopify_6054451904665' }
  });
  
  console.log('Order found:', order);
  console.log('orderConfirmation:', order?.orderConfirmation);
  
  await prisma.$disconnect();
}

checkOrder().catch(console.error);