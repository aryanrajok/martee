#!/usr/bin/env node

/**
 * Startup script for the blockchain listener service
 * This can be run with: node services/start-listener.js
 * Or with ts-node: ts-node services/blockchain-listener.ts
 */

require('dotenv').config();

const path = require('path');

// Check required environment variables
const requiredVars = [
  'DATABASE_URL',
  'ETHEREUM_RPC_WSS',
  'MNEE_TOKEN_ADDRESS'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease create a .env file based on .env.example');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log('🚀 Starting blockchain listener...\n');

// For production: compile TypeScript first or use ts-node
try {
  // Try to require the compiled JavaScript version
  const { startBlockchainListener } = require('./blockchain-listener.js');
  startBlockchainListener();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('❌ Compiled JavaScript not found.');
    console.error('Please run: npm run build');
    console.error('Or use: npx ts-node services/blockchain-listener.ts');
  } else {
    console.error('❌ Failed to start listener:', error);
  }
  process.exit(1);
}
