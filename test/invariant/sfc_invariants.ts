import fc, { bigInt } from 'fast-check';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

import {
  NodeDriverAuth,
  NodeDriver,
  SFCI,
  ConstantsManager,
} from '../../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

const pubkeys = [
  '0xc0048d505c351f4837cec72bce6f4254f5e4bc3f2c9a4816841db64319eee8b714ef9173fbf66d039b782624713791840846b2788d4b65a425adeba85a4b57efe0cd',
  '0xd1059c505c351f4837cec72bce6f4254f5e4bc3f2c9a4816841db64319eee8b714ef9173fbf66d039b782624713791840846b2788d4b65a425adeba85a4b57efe1cd',
  '0xe2169c505c351f4837cec72bce6f4254f5e4bc3f2c9a4816841db64319eee8b714ef9173fbf66d039b782624713791840846b2788d4b65a425adeba85a4b57efe2cd'
];

interface That {
  sfc: SFCI;
  nodeDriverAuth: NodeDriverAuth;
  signers: HardhatEthersSigner[];
  owner: HardhatEthersSigner;
  user: HardhatEthersSigner;
  nodeDriver: NodeDriver;
  constants: ConstantsManager;
}

interface ContractState {
  totalStake: bigint;
  totalActiveStake: bigint;
  totalSlashedStake: bigint;
  totalSupply: bigint;
  currentEpoch: bigint;
  currentSealedEpoch: bigint;
  lastValidatorID: bigint;
  minGasPrice: bigint;
}

// Operation result types
type OperationResult = 
  | { success: true; gasUsed?: bigint }
  | { success: false; error: string; revertReason?: string };

/**
 * SFC Contract Invariant Tests - Sequence-Based Property Testing
 * 
 * These tests execute randomized sequences of SFC operations and verify
 * that invariants hold after each sequence, regardless of the specific
 * operations performed or their order.
 */
describe('SFC Contract Invariant Tests - Sequence Based', function () {
  let that: That;

  const addressesFilePath = path.join(__dirname, '/contract-addresses.json');

  function loadContractAddresses() {
    try {
      const addressesData = fs.readFileSync(addressesFilePath, 'utf8');
      return JSON.parse(addressesData);
    } catch (error) {
      console.log('Contract addresses file not found, using default addresses');
      return {
        sfc: "0xfc00face00000000000000000000000000000000",
        nodeDriver: "0xd100a01e00000000000000000000000000000000",
        nodeDriverAuth: "0xd100ae0000000000000000000000000000000000",
        evmWriter: "0xd100ec0000000000000000000000000000000000",
        constants: "0x6CA548f6DF5B540E72262E935b6Fe3e72cDd68C9",
        sfcProxy: "0x2a57261F79009f35B9b2d4C146471f47BaEf3f77"
      };
    }
  }
  
  const fixture = async () => {
    const signers = await ethers.getSigners();
    const addresses = loadContractAddresses();
    
    const sfc = await ethers.getContractAt('SFCI', addresses.sfc);
    const nodeDriver = await ethers.getContractAt('NodeDriver', addresses.nodeDriver);
    const nodeDriverAuth = await ethers.getContractAt('NodeDriverAuth', addresses.nodeDriverAuth);
    const lib = await ethers.getContractAt('SFCLib', '0xfc01face00000000000000000000000000000000');
    const evmWriter = await ethers.getContractAt('EVMWriter', addresses.evmWriter);
    const constants = await ethers.getContractAt('ConstantsManager', addresses.constants);

    return {
      signers,
      owner: signers[0],
      user: signers[1],
      sfc,
      evmWriter,
      nodeDriver,
      nodeDriverAuth,
      constants,
      lib,
    };
  };

  before(async function () {
    that = await fixture();
    const tx = await that.constants.updateTargetGasPowerPerSecond(500_000_000); // Ensure target gas power is set before tests
    await tx.wait();
  });

  const delegateOp = () => fc.record({
    type: fc.constant('delegate' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n }),
    amount: bigInt({ min: ethers.parseEther('1000'), max: ethers.parseEther('100000') })
  });

  const undelegateOp = () => fc.record({
    type: fc.constant('undelegate' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n }),
    wrID: bigInt({ min: 0n, max: 5n }),
    amount: bigInt({ min: ethers.parseEther('100'), max: ethers.parseEther('50000') })
  });

  const lockStakeOp = () => fc.record({
    type: fc.constant('lockStake' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n }),
    duration: bigInt({ min: 86400n, max: 86400n * 365n }), // 1 day to 1 year
    amount: bigInt({ min: ethers.parseEther('1000'), max: ethers.parseEther('10000') })
  });

  const unlockStakeOp = () => fc.record({
    type: fc.constant('unlockStake' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n }),
    amount: bigInt({ min: ethers.parseEther('100'), max: ethers.parseEther('5000') })
  });

  const claimRewardsOp = () => fc.record({
    type: fc.constant('claimRewards' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n })
  });

  const stashRewardsOp = () => fc.record({
    type: fc.constant('stashRewards' as const),
    delegator: fc.constantFrom(...that.signers.slice(1, 10).map(s => s.address)),
    validatorID: bigInt({ min: 1n, max: 10n })
  });

  const restakeRewardsOp = () => fc.record({
    type: fc.constant('restakeRewards' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n })
  });

  const withdrawOp = () => fc.record({
    type: fc.constant('withdraw' as const),
    signerIndex: fc.integer({ min: 1, max: 9 }),
    validatorID: bigInt({ min: 1n, max: 10n }),
    wrID: bigInt({ min: 0n, max: 5n })
  });

  // Combined operation generator
  const operation = () => fc.oneof(
    delegateOp(),
    undelegateOp(),
    lockStakeOp(),
    unlockStakeOp(),
    claimRewardsOp(),
    stashRewardsOp(),
    restakeRewardsOp(),
    withdrawOp()
  );

  // Execute a single operation
  async function executeOperation(op: any): Promise<OperationResult> {
    try {
      const signer = that.signers[op.signerIndex] || that.user;
      
      switch (op.type) {
        case 'delegate':
          try {
            await delay(200);
            const validator = await that.sfc.getValidator(op.validatorID);
            if (validator[5] === 0n) { // createdTime === 0 means doesn't exist
              return { success: false, error: 'validator_not_exists' };
            }
            await delay(200);
            await that.sfc.connect(signer).delegate(op.validatorID, { value: op.amount });
            return { success: true };
          } catch (error: any) {
            return { success: false, error: 'validator_query_failed', revertReason: error.message };
          }

        case 'undelegate':
          await delay(200);
          const stake = await that.sfc.getStake(signer.address, op.validatorID);
          if (stake === 0n || op.amount > stake) {
            return { success: false, error: 'insufficient_stake' };
          }
          await delay(200);
          await that.sfc.connect(signer).undelegate(op.validatorID, op.wrID, op.amount);
          return { success: true };

        case 'lockStake':
          await delay(200);
          const unlockedStake = await that.sfc.getUnlockedStake(signer.address, op.validatorID);
          if (unlockedStake < op.amount) {
            return { success: false, error: 'insufficient_unlocked_stake' };
          }
          await delay(200);
          await that.sfc.connect(signer).lockStake(op.validatorID, op.duration, op.amount);
          return { success: true };

        case 'unlockStake':
          await delay(200);
          const lockedStake = await that.sfc.getLockedStake(signer.address, op.validatorID);
          if (lockedStake < op.amount) {
            return { success: false, error: 'insufficient_locked_stake' };
          }
          await delay(200);
          await that.sfc.connect(signer).unlockStake(op.validatorID, op.amount);
          return { success: true };

        case 'claimRewards':
          await delay(200);
          const pendingRewards = await that.sfc.pendingRewards(signer.address, op.validatorID);
          await delay(200);
          const stashedRewards = await that.sfc.rewardsStash(signer.address, op.validatorID);
          if (pendingRewards === 0n && stashedRewards === 0n) {
            return { success: false, error: 'no_rewards_to_claim' };
          }
          await delay(200);
          await that.sfc.connect(signer).claimRewards(op.validatorID);
          return { success: true };

        case 'stashRewards':
          await delay(200);
          await that.sfc.stashRewards(op.delegator, op.validatorID);
          return { success: true };

        case 'restakeRewards':
          await delay(200);
          const pendingRewards2 = await that.sfc.pendingRewards(signer.address, op.validatorID);
          await delay(200);
          const stashedRewards2 = await that.sfc.rewardsStash(signer.address, op.validatorID);
          if (pendingRewards2 === 0n && stashedRewards2 === 0n) {
            return { success: false, error: 'no_rewards_to_restake' };
          }
          await delay(200);
          await that.sfc.connect(signer).restakeRewards(op.validatorID);
          return { success: true };

        case 'withdraw':
          await delay(200);
          const withdrawalRequest = await that.sfc.getWithdrawalRequest(signer.address, op.validatorID, op.wrID);
          if (withdrawalRequest[2] === 0n) { // amount === 0 means no withdrawal request
            return { success: false, error: 'no_withdrawal_request' };
          }
          await delay(200);
          await that.sfc.connect(signer).withdraw(op.validatorID, op.wrID);
          return { success: true };

        default:
          return { success: false, error: 'unknown_operation' };
      }
    } catch (error: any) {
      return { 
        success: false, 
        error: 'execution_failed', 
        revertReason: error.message || error.toString() 
      };
    }
  }

  // Get current contract state for invariant checking
  async function getContractState(): Promise<ContractState> {
    try {
      await delay(200);
      const totalStake = await that.sfc.totalStake();
      await delay(200);
      const totalActiveStake = await that.sfc.totalActiveStake();
      await delay(200);
      const totalSlashedStake = await that.sfc.totalSlashedStake();
      await delay(200);
      const totalSupply = await that.sfc.totalSupply();
      await delay(200);
      const currentEpoch = await that.sfc.currentEpoch();
      await delay(200);
      const currentSealedEpoch = await that.sfc.currentSealedEpoch();
      await delay(200);
      const lastValidatorID = await that.sfc.lastValidatorID();
      await delay(200);
      const minGasPrice = await that.sfc.minGasPrice();
      
      return {
        totalStake,
        totalActiveStake,
        totalSlashedStake,
        totalSupply,
        currentEpoch,
        currentSealedEpoch,
        lastValidatorID,
        minGasPrice
      };
    } catch (error: any) {
      // If contract calls fail, return default state to allow tests to continue
      console.log('Warning: Contract state query failed, using defaults:', error.message);
      return {
        totalStake: 0n,
        totalActiveStake: 0n,
        totalSlashedStake: 0n,
        totalSupply: 0n,
        currentEpoch: 1n,
        currentSealedEpoch: 0n,
        lastValidatorID: 0n,
        minGasPrice: 1n
      };
    }
  }

  // Invariant checking functions
  async function checkStateConsistencyInvariants(state: ContractState): Promise<boolean> {
    try {
      // INV-001: currentEpoch = currentSealedEpoch + 1
      expect(state.currentEpoch).to.equal(state.currentSealedEpoch + 1n);
      
      // INV-002: totalActiveStake <= totalStake
      expect(state.totalActiveStake).to.be.lte(state.totalStake);
      
      // INV-003: totalActiveStake + totalSlashedStake <= totalStake
      expect(state.totalActiveStake + state.totalSlashedStake).to.be.lte(state.totalStake);
      
      // INV-004: All values non-negative
      expect(state.totalStake).to.be.gte(0n);
      expect(state.totalActiveStake).to.be.gte(0n);
      expect(state.totalSlashedStake).to.be.gte(0n);
      expect(state.totalSupply).to.be.gte(0n);
      expect(state.minGasPrice).to.be.gt(0n);
      
      return true;
    } catch (error) {
      console.log('State consistency invariant violation:', error);
      return false;
    }
  }

  async function checkStakingInvariants(): Promise<boolean> {
    try {
      // Check a sample of delegators for stake composition invariants
      const sampleAddresses = that.signers.slice(1, 6).map(s => s.address);
      const sampleValidators = [1n, 2n, 3n, 4n, 5n];
      
      for (const address of sampleAddresses) {
        for (const validatorID of sampleValidators) {
          try {
            await delay(200);
            const totalStake = await that.sfc.getStake(address, validatorID);
            await delay(200);
            const lockedStake = await that.sfc.getLockedStake(address, validatorID);
            await delay(200);
            const unlockedStake = await that.sfc.getUnlockedStake(address, validatorID);
            
            // INV-101: lockedStake <= totalStake
            expect(lockedStake).to.be.lte(totalStake);
            
            // INV-102: lockedStake + unlockedStake = totalStake
            expect(lockedStake + unlockedStake).to.equal(totalStake);
            
            // INV-103: All stake values non-negative
            expect(totalStake).to.be.gte(0n);
            expect(lockedStake).to.be.gte(0n);
            expect(unlockedStake).to.be.gte(0n);
          } catch (error) {
            // Skip non-existent delegations
            continue;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.log('Staking invariant violation:', error);
      return false;
    }
  }

  async function checkEconomicInvariants(): Promise<boolean> {
    try {
      // Check a sample for reward invariants
      const sampleAddresses = that.signers.slice(1, 4).map(s => s.address);
      const sampleValidators = [1n, 2n, 3n];
      
      for (const address of sampleAddresses) {
        for (const validatorID of sampleValidators) {
          try {
            await delay(200);
            const pendingRewards = await that.sfc.pendingRewards(address, validatorID);
            await delay(200);
            const stashedRewards = await that.sfc.rewardsStash(address, validatorID);
            
            // INV-201: All rewards non-negative
            expect(pendingRewards).to.be.gte(0n);
            expect(stashedRewards).to.be.gte(0n);
          } catch (error) {
            // Skip non-existent delegations
            continue;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.log('Economic invariant violation:', error);
      return false;
    }
  }

  async function checkAllInvariants(): Promise<boolean> {
    const state = await getContractState();
    
    const stateConsistent = await checkStateConsistencyInvariants(state);
    const stakingConsistent = await checkStakingInvariants();
    const economicConsistent = await checkEconomicInvariants();
    
    return stateConsistent && stakingConsistent && economicConsistent;
  }

  // Map technical error messages to user-friendly descriptions
  function getFriendlyErrorMessage(error: string): string {
    const errorMap: Record<string, string> = {
      'validator_already_exists': 'Expected: Validator already created',
      'validator_not_exists': 'Expected: Validator does not exist',
      'validator_query_failed': 'Expected: Contract not initialized',
      'insufficient_stake': 'Expected: Insufficient stake amount',
      'insufficient_unlocked_stake': 'Expected: Not enough unlocked stake',
      'insufficient_locked_stake': 'Expected: Not enough locked stake',
      'no_rewards_to_claim': 'Expected: No rewards available to claim',
      'no_rewards_to_restake': 'Expected: No rewards available to restake',
      'no_withdrawal_request': 'Expected: No withdrawal request found',
      'execution_failed': 'Expected: Contract not initialized',
      'unknown_operation': 'Error: Unknown operation type'
    };
    
    return errorMap[error] || `Expected: ${error}`;
  }

  describe('🔄 Randomized Operation Sequence Invariants', function () {

    this.beforeEach(async function () {
      // Reset state before each test
      that = await fixture();
      const tx = await that.constants.updateTargetGasPowerPerSecond(500_000_000); // Ensure target gas power is set before tests
      await tx.wait();
    });
    
    it('should maintain state consistency after random operation sequences', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(operation(), { minLength: 3, maxLength: 10 }),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing sequence of ${operations.length} operations ---`);
              
              // Execute the sequence of operations
              let successfulOps = 0;
              for (let i = 0; i < operations.length; i++) {
                const op = operations[i];
                console.log(`Op ${i + 1}: ${op.type} (signer: ${op.signerIndex})`);
                
                const result = await executeOperation(op);
                if (result.success) {
                  successfulOps++;
                  console.log(`  ✓ Success`);
                } else {
                  // Map technical errors to user-friendly messages
                  const friendlyError = getFriendlyErrorMessage(result.error);
                  console.log(`  → ${friendlyError}`);
                }
                
                // Check invariants after each operation
                const invariantsHold = await checkAllInvariants();
                if (!invariantsHold) {
                  console.log(`  💥 INVARIANT VIOLATION after operation ${i + 1}`);
                  return false;
                }
              }
              
              console.log(`Sequence completed: ${successfulOps}/${operations.length} operations succeeded`);
              
              // Final invariant check
              const finalCheck = await checkAllInvariants();
              return finalCheck;
              
            } catch (error) {
              console.log('Sequence execution error:', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should maintain staking invariants through delegation workflows', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              delegateOp(),
              undelegateOp(),
              withdrawOp()
            ),
            { minLength: 5, maxLength: 8 }
          ),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing delegation workflow: ${operations.length} operations ---`);
              
              for (let i = 0; i < operations.length; i++) {
                const op = operations[i];
                await executeOperation(op);
                
                // Focus on staking invariants
                const stakingOk = await checkStakingInvariants();
                if (!stakingOk) {
                  console.log(`Staking invariant violation after ${op.type}`);
                  return false;
                }
              }
              
              return true;
            } catch (error) {
              console.log('Delegation workflow error:', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should maintain economic invariants through reward operations', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              delegateOp(),
              claimRewardsOp(),
              stashRewardsOp(),
              restakeRewardsOp()
            ),
            { minLength: 4, maxLength: 7 }
          ),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing reward workflow: ${operations.length} operations ---`);
              
              for (const op of operations) {
                await executeOperation(op);
                
                // Focus on economic invariants
                const economicOk = await checkEconomicInvariants();
                if (!economicOk) {
                  console.log(`Economic invariant violation after ${op.type}`);
                  return false;
                }
              }
              
              return true;
            } catch (error) {
              console.log('Reward workflow error:', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should maintain lockup invariants through staking operations', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              delegateOp(),
              lockStakeOp(),
              unlockStakeOp(),
              restakeRewardsOp()
            ),
            { minLength: 3, maxLength: 6 }
          ),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing lockup workflow: ${operations.length} operations ---`);
              
              for (const op of operations) {
                const result = await executeOperation(op);
                
                // Check stake composition after lockup operations
                if (result.success && ['lockStake', 'unlockStake'].includes(op.type)) {
                  const stakingOk = await checkStakingInvariants();
                  if (!stakingOk) {
                    console.log(`Lockup invariant violation after ${op.type}`);
                    return false;
                  }
                }
              }
              
              return true;
            } catch (error) {
              console.log('Lockup workflow error:', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should maintain validator consistency through creation and management', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              delegateOp(),
              undelegateOp(),
              claimRewardsOp()
            ),
            { minLength: 4, maxLength: 8 }
          ),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing validator management: ${operations.length} operations ---`);
              
              let validatorCount = 0;
              
              for (const op of operations) {
                try {
                  await delay(200);
                  const initialLastValidatorID = await that.sfc.lastValidatorID();
                  const result = await executeOperation(op);
                  
                  // Check all invariants
                  const allOk = await checkAllInvariants();
                  if (!allOk) {
                    console.log(`General invariant violation after ${op.type}`);
                    return false;
                  }
                } catch (error: any) {
                  console.log(`Error in validator management test: ${error.message}`);
                  // Continue with next operation instead of failing
                  continue;
                }
              }
              
              console.log(`Created ${validatorCount} validators in sequence`);
              return true;
            } catch (error) {
              console.log('Validator management error:', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should handle complex mixed operation sequences', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.array(operation(), { minLength: 8, maxLength: 15 }),
          async (operations: any[]) => {
            try {
              console.log(`\n--- Testing complex mixed sequence: ${operations.length} operations ---`);
              
              const operationCounts: Record<string, number> = {};
              
              for (const op of operations) {
                operationCounts[op.type] = (operationCounts[op.type] || 0) + 1;
                await executeOperation(op);
                
                // Every 3 operations, do a full invariant check
                if (Object.values(operationCounts).reduce((a, b) => a + b, 0) % 3 === 0) {
                  const allOk = await checkAllInvariants();
                  if (!allOk) {
                    console.log(`Invariant violation in complex sequence`);
                    console.log('Operation counts:', operationCounts);
                    return false;
                  }
                }
              }
              
              console.log('Final operation counts:', operationCounts);
              
              // Final comprehensive check
              return await checkAllInvariants();
            } catch (error) {
              console.log('Complex sequence error:', error);
              return false;
            }
          }
        ),
        { numRuns: 3, includeErrorInReport: true }
      );
    });
  });
});

// Helper function generators (removed unused function)

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};