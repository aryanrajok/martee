# 🚀 DEPLOY YOUR BNB TEST TOKEN - EASY GUIDE

Follow these steps in order. I'll guide you through everything!

## ✅ STEP 1: Add BNB Testnet to MetaMask

### Manual Method:
1. Open MetaMask extension in your browser
2. Click the network dropdown (top left, currently shows your network)
3. Click "Add Network" button
4. Click "Add a network manually" at the bottom
5. Enter these EXACT details:

   ```
   Network Name: BNB Smart Chain Testnet
   New RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545
   Chain ID: 97
   Currency Symbol: tBNB
   Block Explorer URL: https://testnet.bscscan.com
   ```

6. Click "Save"
7. Switch to "BNB Smart Chain Testnet" network

### OR Use Chainlist (Easier):
1. Go to: https://chainlist.org
2. Search for "BNB testnet"
3. Find "BNB Smart Chain Testnet (97)"
4. Click "Add to MetaMask"
5. Approve in MetaMask popup

---

## ✅ STEP 2: Get Test BNB (For Gas Fees)

1. Copy your wallet address from MetaMask
2. Go to: https://testnet.bnbchain.org/faucet-smart
3. Paste your wallet address
4. Complete the captcha
5. Click "Give me BNB"
6. Wait 30 seconds - you should receive 0.5 tBNB
7. Check MetaMask - you should see the tBNB balance

**IMPORTANT:** You MUST have test BNB before deploying! No BNB = No deployment ❌

---

## ✅ STEP 3: Open Remix IDE

1. Go to: https://remix.ethereum.org
2. Wait for it to load (may take 10-20 seconds)
3. You'll see a file browser on the left

---

## ✅ STEP 4: Create the Token Contract File

1. In Remix, click the "File Explorer" icon (📁) on the left sidebar
2. In the "contracts" folder, click the "+" button to create a new file
3. Name it: `TestBNBToken.sol`
4. Click the file to open it
5. DELETE any default code
6. Copy ALL the code from your local file: `e:\projects\martee\contracts\TestBNBToken.sol`
7. Paste it into Remix

**The file should start with:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
```

---

## ✅ STEP 5: Compile the Contract

1. Click the "Solidity Compiler" icon (📋) on the left sidebar (2nd icon from top)
2. Make sure "Compiler" is set to: `0.8.20` or higher
3. Click the big blue "Compile TestBNBToken.sol" button
4. **Success = Green checkmark ✅**
5. **If you see errors:** Make sure you copied the entire contract code

---

## ✅ STEP 6: Deploy the Contract

1. Click the "Deploy & Run Transactions" icon (🚀) on the left sidebar (3rd icon)
2. In "Environment" dropdown, select: **"Injected Provider - MetaMask"**
3. MetaMask will popup - Click "Connect"
4. **IMPORTANT:** Make sure MetaMask shows "BNB Smart Chain Testnet" (Chain 97)
5. In "Contract" dropdown, select: **"TestBNBToken - TestBNBToken.sol"**
6. You'll see a field for constructor parameter (INITIALSUPPLY)
7. Enter this EXACT number: `1000000000000000000000000000`
   (That's 1 billion tokens with 18 decimals)

8. Click the orange "Deploy" button
9. MetaMask will popup asking to confirm transaction
10. Click "Confirm" (gas fee should be very small, like 0.001 tBNB)
11. Wait 5-10 seconds for transaction to confirm

---

## ✅ STEP 7: Copy the Deployed Contract Address

1. After deployment, look at the bottom of the "Deployed Contracts" section
2. You'll see: "TESTBNBTOKEN AT 0x..." 
3. Click the copy icon (📋) next to the address
4. **SAVE THIS ADDRESS!** - You'll need it in the next step

Example address format: `0x1234567890abcdef1234567890abcdef12345678`
0xA22985Ce784dfe6298EAB97946eE9d5d5796419a

---

## ✅ STEP 8: Verify Deployment on BSCScan (Optional but Recommended)

1. Go to: https://testnet.bscscan.com
2. Paste your contract address in the search bar
3. Press Enter
4. You should see your contract!
5. Click on the address to see details

---

## ✅ STEP 9: Update Your .env File

1. Open your project's `.env` file
2. Find these lines:
   ```
   MNEE_TOKEN_ADDRESS="0x0000000000000000000000000000000000000000"
   NEXT_PUBLIC_MNEE_TOKEN_ADDRESS="0x0000000000000000000000000000000000000000"
   ```

3. Replace `0x0000...` with YOUR deployed contract address:
   ```
   MNEE_TOKEN_ADDRESS="0xYourActualContractAddress"
   NEXT_PUBLIC_MNEE_TOKEN_ADDRESS="0xYourActualContractAddress"
   ```

4. Save the file

---

## ✅ STEP 10: Restart Your Development Server

1. Go to your terminal where `npm run dev` is running
2. Press `Ctrl+C` to stop it
3. Run: `npm run dev` again
4. Wait for it to start

---

## ✅ STEP 11: Test Everything!

1. Open: http://localhost:3000
2. Connect your MetaMask wallet
3. Make sure it's on BNB Testnet
4. Go to: http://localhost:3000/faucet
5. Click "Mint Tokens"
6. Approve the transaction in MetaMask
7. Wait for confirmation
8. Success! 🎉

---

## 🔍 Troubleshooting

### "Insufficient funds for intrinsic transaction cost"
- You need test BNB! Go back to Step 2

### "Wrong network"
- Switch MetaMask to BNB Smart Chain Testnet (Chain ID 97)

### "Transaction failed"
- Check you entered the constructor parameter correctly
- Make sure you have enough test BNB (at least 0.01 tBNB)

### Contract won't compile
- Make sure you copied the ENTIRE contract code
- Check the Solidity version is 0.8.20 or higher

### MetaMask doesn't show "Injected Provider"
- Make sure MetaMask is installed and unlocked
- Refresh the Remix page
- Try disconnecting and reconnecting MetaMask

---

## 📝 Summary Checklist

- [ ] BNB Testnet added to MetaMask
- [ ] Test BNB received (check balance)
- [ ] Contract created in Remix
- [ ] Contract compiled successfully
- [ ] Contract deployed via MetaMask
- [ ] Contract address copied
- [ ] `.env` file updated with address
- [ ] Dev server restarted
- [ ] Tested on faucet page

---

## 🆘 Need Help?

If you get stuck at any step, let me know which step number and what error you're seeing!

---

**Remember:** 
- Keep your contract address safe
- You can always mint more test tokens from the faucet
- This is testnet only - no real money involved!

Good luck! 🚀
