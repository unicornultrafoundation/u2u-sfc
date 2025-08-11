#!/usr/bin/env bun

import { ethers } from 'hardhat';

/**
 * Update Target Gas Power Per Second Script
 * 
 * Updates the targetGasPowerPerSecond parameter in the ConstantsManager contract
 * before running tests to ensure proper configuration.
 */

async function updateTargetGasPower() {
  try {
    const cm = await ethers.getContractAt('ConstantsManager', '0x6CA548f6DF5B540E72262E935b6Fe3e72cDd68C9');

    // Update the targetGasPowerPerSecond to a new value
    const newValue = 500_000_000; // Example value, adjust as needed
    const tx = await cm.updateTargetGasPowerPerSecond(newValue);
    await tx.wait();
    console.log(`Updated targetGasPowerPerSecond to: ${newValue}`);
    console.log(`Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error('❌ Failed to update targetGasPowerPerSecond:', error);
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateTargetGasPower().catch((error) => {
    console.error('=� Unexpected error:', error);
    process.exit(1);
  });
}

export default updateTargetGasPower;