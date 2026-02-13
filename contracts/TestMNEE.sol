// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestMNEE
 * @dev Test MNEE token for Sepolia testnet with public minting for faucet functionality
 * This is a testnet-only token - DO NOT use in production
 */
contract TestMNEE is ERC20, Ownable {
    // Maximum amount that can be minted per transaction (1,000,000 tokens)
    uint256 public constant MAX_MINT_AMOUNT = 1_000_000 * 10**18;
    
    // Cooldown period between mints (1 hour)
    uint256 public constant MINT_COOLDOWN = 1 hours;
    
    // Track last mint time for each address
    mapping(address => uint256) public lastMintTime;
    
    constructor(uint256 initialSupply)
        ERC20("Test MNEE", "tMNEE")
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Public mint function for faucet - anyone can mint test tokens
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) external {
        require(amount <= MAX_MINT_AMOUNT, "Amount exceeds maximum mint limit");
        require(
            block.timestamp >= lastMintTime[to] + MINT_COOLDOWN,
            "Mint cooldown period not elapsed"
        );
        
        lastMintTime[to] = block.timestamp;
        _mint(to, amount);
    }

    /**
     * @dev Owner-only mint function for special cases
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint
     */
    function ownerMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
