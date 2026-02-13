'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

import { Droplets, CheckCircle, AlertCircle, Loader2, Wallet } from 'lucide-react';

const MNEE_TOKEN_ADDRESS = '0x49F65A3C616Cd9B83DE5615D39e01B49bE14b643' as `0x${string}`;
const MINT_AMOUNT = '1000000'; // 1,000,000 tokens

// Minimal ABI for mint function
const mintAbi = [
  {
    name: 'mint',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const;

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const [mintAmount, setMintAmount] = useState(MINT_AMOUNT);
  
  const { 
    writeContract, 
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess 
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = () => {
    if (!address) return;
    
    const amount = mintAmount
    
    writeContract({
      address: MNEE_TOKEN_ADDRESS,
      abi: mintAbi,
      functionName: 'mint',
      args: [address, BigInt(amount)]
    });
  };

  const handleReset = () => {
    reset();
    setMintAmount(MINT_AMOUNT);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3">
            <Droplets className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">MNEE Token Faucet</h1>
              <p className="text-sm text-gray-600">Ethereum Sepolia Testnet</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {!isConnected ? (
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
                <p className="text-gray-600 mb-6">Please connect your wallet to request test tokens</p>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Request Test Tokens</h2>
                  <p className="text-gray-600">Get test MNEE tokens for development and testing on Ethereum Sepolia testnet</p>
                </div>

                {/* Token Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Token Contract:</span>
                    <a 
                      href={`https://sepolia.etherscan.io/address/${MNEE_TOKEN_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      {MNEE_TOKEN_ADDRESS.slice(0, 10)}...{MNEE_TOKEN_ADDRESS.slice(-8)}
                    </a>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Your Address:</span>
                    <span className="font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Mint
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter amount"
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                      MNEE
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">Default: 1,000,000 MNEE tokens</p>
                </div>

                {/* Status Messages */}
                {writeError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Transaction Failed</p>
                      <p className="text-sm text-red-700 mt-1">
                        {writeError.message.includes('User rejected') 
                          ? 'Transaction was rejected by user'
                          : writeError.message.slice(0, 100)}
                      </p>
                    </div>
                  </div>
                )}

                {isConfirming && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Confirming Transaction</p>
                      <p className="text-sm text-blue-700">Please wait while your transaction is being confirmed...</p>
                    </div>
                  </div>
                )}

                {isSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">Success!</p>
                        <p className="text-sm text-green-700 mt-1">
                          {mintAmount} MNEE tokens have been minted to your wallet.
                        </p>
                        {hash && (
                          <a 
                            href={`https://sepolia.etherscan.io/tx/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-600 hover:text-green-700 underline mt-2 inline-block"
                          >
                            View transaction
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  {isSuccess ? (
                    <button
                      onClick={handleReset}
                      className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >
                      Request More Tokens
                    </button>
                  ) : (
                    <button
                      onClick={handleMint}
                      disabled={isWritePending || isConfirming || !address}
                      className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2
                        ${isWritePending || isConfirming
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                      {isWritePending || isConfirming ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{isWritePending ? 'Confirm in Wallet' : 'Minting...'}</span>
                        </>
                      ) : (
                        <>
                          <Droplets className="w-5 h-5" />
                          <span>Mint Tokens</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="mt-8 bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">How it works</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li>1. First, get Sepolia ETH for gas fees from <a href="https://www.alchemy.com/faucets/ethereum-sepolia" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Alchemy Sepolia Faucet</a> or <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Sepolia PoW Faucet</a></li>
              <li>2. Connect your wallet to the Ethereum Sepolia testnet (chainId: 11155111)</li>
              <li>3. Enter the amount of test tokens you need (default: 1,000,000)</li>
              <li>4. Click "Mint Tokens" and approve the transaction</li>
              <li>5. Wait for confirmation and your tokens will be available</li>
              <li>6. Add the token contract address {MNEE_TOKEN_ADDRESS} to your wallet</li>
              <li>7. Test the payment gateway with your WooCommerce or Shopify store!</li>
            </ol>
            <p className="mt-4 text-xs text-gray-600">
              Note: These are test tokens on the Sepolia testnet for development purposes only and have no real value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}