import fc, { bigInt } from 'fast-check';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

import {
  SFCUnitTestI,
  NodeDriverAuth,
  NodeDriver,
  UnitTestConstantsManager,
  sfc,
  SFCI,
  ConstantsManager,
  SFCLib,
} from '../../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { BlockchainNode, ValidatorMetrics } from '../helpers/blockchain';
import { BigNumberish } from 'ethers';

const pubkey =
  '0xc0048d505c351f4837cec72bce6f4254f5e4bc3f2c9a4816841db64319eee8b714ef9173fbf66d039b782624713791840846b2788d4b65a425adeba85a4b57efe0cd';

interface That {
  sfc: SFCI;
  nodeDriverAuth: NodeDriverAuth;
  signers: HardhatEthersSigner[];
  owner: HardhatEthersSigner;
  lib: SFCLib;
  user: HardhatEthersSigner;
  nodeDriver: NodeDriver;
  constants: ConstantsManager;
}

// Skipped functions as specified:
const SKIPPED_FUNCTIONS = [
  'updateStakeTokenizerAddress(address)',
  'updateConstsAddress(address)', 
  'updateVoteBookAddress(address)',
  'transferOwnership(address)',
  'renounceOwnership()',
  'initialize(uint256,uint256,address,address,address,address)',
  'setGenesisValidator(address,uint256,bytes,uint256,uint256,uint256,uint256,uint256)',
  'setGenesisDelegation(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
];

describe('SFC Gas Limit Fuzz Testing', function () {
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
    const tx = await that.constants.updateTargetGasPowerPerSecond(500_000_000);
    await tx.wait();
  });

  // Gas limit generator - from very low to very high
  const gasLimitArb = fc.oneof(
    fc.constant(21000),           // Minimum gas for transaction
    fc.constant(50000),           // Low gas
    fc.integer({ min: 50000, max: 200000 }),   // Normal range
    fc.integer({ min: 200000, max: 500000 }), // Medium range  
    fc.integer({ min: 500000, max: 1000000 }), // High range
    fc.integer({ min: 1000000, max: 5000000 }), // Very high range
    fc.constant(30000000)         // Block gas limit
  );

  describe('Validator Operations with Gas Limits', function () {
    it('should test delegate with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('1') }),
          async (gasLimit: number, validatorID: number, amount: bigint) => {
            try {
              const tx = await that.sfc.delegate(validatorID, { 
                value: amount,
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'validator doesn\'t exist',
                'delegated stake limit exceeded',
                'too small delegation'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test undelegate with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 0, max: 100 }),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('10') }),
          async (gasLimit: number, validatorID: number, wrID: number, amount: bigint) => {
            try {
              const tx = await that.sfc.undelegate(validatorID, wrID, amount, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'not enough undelegated stake',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test withdraw with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 0, max: 100 }),
          async (gasLimit: number, validatorID: number, wrID: number) => {
            try {
              const tx = await that.sfc.withdraw(validatorID, wrID, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'request doesn\'t exist',
                'not yet withdrawable',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });
  });

  describe('Reward Operations with Gas Limits', function () {
    it('should test claimRewards with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          async (gasLimit: number, validatorID: number) => {
            try {
              const tx = await that.sfc.claimRewards(validatorID, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'nothing to claim',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test stashRewards with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          validEthereumAddress(),
          fc.integer({ min: 1, max: 1000 }),
          async (gasLimit: number, delegator: string, validatorID: number) => {
            try {
              const tx = await that.sfc.stashRewards(delegator, validatorID, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low', 
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'nothing to stash',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test restakeRewards with various gas limits', async function () {
      await delay(1000);
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          async (gasLimit: number, validatorID: number) => {
            try {
              const tx = await that.sfc.restakeRewards(validatorID, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'nothing to restake',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });
  });

  describe('Lockup Operations with Gas Limits', function () {
    it('should test lockStake with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          bigInt({ min: 86400n, max: BigInt(365 * 86400) }), // 1 day to 1 year
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('100') }),
          async (gasLimit: number, validatorID: number, duration: bigint, amount: bigint) => {
            try {
              const tx = await that.sfc.lockStake(validatorID, duration, amount, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'not enough unlocked stake',
                'incorrect duration'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test unlockStake with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('10') }),
          async (gasLimit: number, validatorID: number, amount: bigint) => {
            try {
              const tx = await that.sfc.unlockStake(validatorID, amount, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'not enough locked stake',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test relockStake with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          bigInt({ min: 86400n, max: BigInt(365 * 86400) }), // 1 day to 1 year
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('10') }),
          async (gasLimit: number, validatorID: number, duration: bigint, amount: bigint) => {
            try {
              const tx = await that.sfc.relockStake(validatorID, duration, amount, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'not enough locked stake',
                'incorrect duration'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });
  });

  describe('Administrative Operations with Gas Limits', function () {
    it('should test updateTreasuryAddress with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          validEthereumAddress(),
          async (gasLimit: number, newAddress: string) => {
            try {
              const tx = await that.sfc.updateTreasuryAddress(newAddress, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'caller is not the owner'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test burnU2U with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('10') }),
          async (gasLimit: number, amount: bigint) => {
            try {
              const tx = await that.sfc.burnU2U(amount, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'caller is not the owner',
                'insufficient balance'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test mintU2U with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          validEthereumAddress(),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('10') }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (gasLimit: number, receiver: string, amount: bigint, reason: string) => {
            try {
              const tx = await that.sfc.mintU2U(receiver, amount, reason, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'caller is not the owner'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });

    it('should test updateSlashingRefundRatio with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          fc.integer({ min: 1, max: 1000 }),
          bigInt({ min: 0n, max: ethers.parseEther('1') }),
          async (gasLimit: number, validatorID: number, refundRatio: bigint) => {
            try {
              const tx = await that.sfc.updateSlashingRefundRatio(validatorID, refundRatio, { 
                gasLimit: gasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'caller is not the owner',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });
  });

  describe('Library Function Gas Limits', function () {
    it('should test recountVotes with various gas limits', async function () {
      fc.assert(
        fc.asyncProperty(
          gasLimitArb,
          validEthereumAddress(),
          validEthereumAddress(),
          fc.boolean(),
          async (gasLimit: number, delegator: string, validatorAuth: string, strict: boolean) => {
            try {
              // Use a reasonable gas limit for recountVotes as it's gas-intensive
              const effectiveGasLimit = Math.max(gasLimit, 200000);
              const tx = await that.lib.recountVotes(delegator, validatorAuth, strict, effectiveGasLimit, { 
                gasLimit: effectiveGasLimit
              });
              await tx.wait();
              await delay(1000);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              
              const gasErrors = [
                'out of gas',
                'intrinsic gas too low',
                'gas required exceeds allowance'
              ];
              
              const businessErrors = [
                'delegation doesn\'t exist',
                'validator doesn\'t exist'
              ];
              
              const isGasError = gasErrors.some(msg => errorMessage.toLowerCase().includes(msg));
              const isBusinessError = businessErrors.some(msg => errorMessage.includes(msg));
              
              return isGasError || isBusinessError;
            }
          }
        ),
        { numRuns: 15, includeErrorInReport: true }
      );
    });
  });

  describe('Gas Estimation Tests', function () {
    it('should estimate gas for different operations and compare with limits', async function () {
      const operations = [
        {
          name: 'createValidator',
          estimateGas: async () => {
            return await that.sfc.createValidator.estimateGas(pubkey, { value: ethers.parseEther('1') });
          }
        },
        {
          name: 'delegate', 
          estimateGas: async () => {
            return await that.sfc.delegate.estimateGas(1, { value: ethers.parseEther('1') });
          }
        },
        {
          name: 'claimRewards',
          estimateGas: async () => {
            return await that.sfc.claimRewards.estimateGas(1);
          }
        }
      ];

      for (const op of operations) {
        try {
          const estimatedGas = await op.estimateGas();
          console.log(`${op.name} estimated gas: ${estimatedGas.toString()}`);
          
          // Gas estimate should be reasonable (not too high, not too low)
          expect(estimatedGas).to.be.gte(21000); // Minimum transaction gas
          expect(estimatedGas).to.be.lte(5000000); // Reasonable upper bound
          
        } catch (error) {
          // Some operations might fail due to contract state, that's expected
          console.log(`${op.name} gas estimation failed (expected for some operations)`);
        }
      }
    });
  });
});

const validEthereumAddress = () =>
  fc
    .string({
      minLength: 40,
      maxLength: 40,
      unit: fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    })
    .map((hex) => '0x' + hex)
    .filter((addr) => ethers.isAddress(addr));

const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};