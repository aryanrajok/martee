const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMerchant() {
  try {
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        walletAddress: true,
        name: true,
        apiKey: true,
        wooCommerceEnabled: true,
        wooCommerceSiteURL: true,
        createdAt: true
      }
    });
    
    console.log('Merchants in database:');
    console.log(JSON.stringify(merchants, null, 2));
    
    // Check specifically for the API key the user is trying
    const merchantWithKey = await prisma.merchant.findUnique({
      where: { apiKey: 'eda8070fcefc02c5' }
    });
    
    if (merchantWithKey) {
      console.log('\nFound merchant with API key "eda8070fcefc02c5":');
      console.log(JSON.stringify(merchantWithKey, null, 2));
    } else {
      console.log('\nNo merchant found with API key "eda8070fcefc02c5"');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMerchant();
