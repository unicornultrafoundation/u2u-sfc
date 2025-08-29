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
  user: HardhatEthersSigner;
  nodeDriver: NodeDriver;
  constants: ConstantsManager;
}

describe('SFC Getter Methods Fuzz Tests', function () {
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
  });

  describe('Basic State Getters', function () {
    it('should return valid currentSealedEpoch', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const currentSealedEpoch = await that.sfc.currentSealedEpoch();
            expect(currentSealedEpoch).to.be.a('bigint');
            expect(currentSealedEpoch).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid currentEpoch', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const currentEpoch = await that.sfc.currentEpoch();
            const currentSealedEpoch = await that.sfc.currentSealedEpoch();
            expect(currentEpoch).to.be.a('bigint');
            expect(currentEpoch).to.equal(currentSealedEpoch + 1n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid totalSupply', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const totalSupply = await that.sfc.totalSupply();
            expect(totalSupply).to.be.a('bigint');
            expect(totalSupply).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid totalStake', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const totalStake = await that.sfc.totalStake();
            expect(totalStake).to.be.a('bigint');
            expect(totalStake).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid totalActiveStake', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const totalActiveStake = await that.sfc.totalActiveStake();
            expect(totalActiveStake).to.be.a('bigint');
            expect(totalActiveStake).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid totalSlashedStake', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const totalSlashedStake = await that.sfc.totalSlashedStake();
            expect(totalSlashedStake).to.be.a('bigint');
            expect(totalSlashedStake).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid lastValidatorID', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const lastValidatorID = await that.sfc.lastValidatorID();
            expect(lastValidatorID).to.be.a('bigint');
            expect(lastValidatorID).to.be.gte(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid minGasPrice', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const minGasPrice = await that.sfc.minGasPrice();
            expect(minGasPrice).to.be.a('bigint');
            expect(minGasPrice).to.be.gt(0n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('Address Getters', function () {
    it('should return valid owner address', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const owner = await that.sfc.owner();
            expect(ethers.isAddress(owner)).to.be.true;
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid treasuryAddress', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const treasuryAddress = await that.sfc.treasuryAddress();
            if (treasuryAddress !== ethers.ZeroAddress) {
              expect(ethers.isAddress(treasuryAddress)).to.be.true;
            }
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid stakeTokenizerAddress', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const stakeTokenizerAddress = await that.sfc.stakeTokenizerAddress();
            if (stakeTokenizerAddress !== ethers.ZeroAddress) {
              expect(ethers.isAddress(stakeTokenizerAddress)).to.be.true;
            }
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    it('should return valid constsAddress', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const constsAddress = await that.sfc.constsAddress();
            expect(ethers.isAddress(constsAddress)).to.be.true;
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });

    // it('should handle voteBookAddress with random addresses', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(
    //       validEthereumAddress(),
    //       async (address: string) => {
    //         try {
    //           const voteBookAddress = await that.sfc.voteBookAddress(address);
    //           if (voteBookAddress !== ethers.ZeroAddress) {
    //             expect(ethers.isAddress(voteBookAddress)).to.be.true;
    //           }
    //           return true;
    //         } catch (error) {
    //           console.log(' ---> error: ', error);
    //           return false;
    //         }
    //       }
    //     ),
    //     { numRuns: 10, includeErrorInReport: true }
    //   );
    // });
  });

  describe('Validator-related Getters', function () {
    it('should handle getValidator with random validatorIDs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          async (validatorID: bigint) => {
            try {
              const validator = await that.sfc.getValidator(validatorID);
              expect(validator).to.have.length(7);
              expect(validator[0]).to.be.a('bigint'); // status
              expect(validator[1]).to.be.a('bigint'); // deactivatedTime
              expect(validator[2]).to.be.a('bigint'); // deactivatedEpoch
              expect(validator[3]).to.be.a('bigint'); // receivedStake
              expect(validator[4]).to.be.a('bigint'); // createdEpoch
              expect(validator[5]).to.be.a('bigint'); // createdTime
              expect(ethers.isAddress(validator[6])).to.be.true; // auth
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getValidatorID with random addresses', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          async (address: string) => {
            try {
              const validatorID = await that.sfc.getValidatorID(address);
              expect(validatorID).to.be.a('bigint');
              expect(validatorID).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getValidatorPubkey with random validatorIDs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          async (validatorID: bigint) => {
            try {
              const pubkey = await that.sfc.getValidatorPubkey(validatorID);
              expect(pubkey).to.be.a('string');
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getSelfStake with random validatorIDs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          async (validatorID: bigint) => {
            try {
              const selfStake = await that.sfc.getSelfStake(validatorID);
              expect(selfStake).to.be.a('bigint');
              expect(selfStake).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle isSlashed with random validatorIDs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          async (validatorID: bigint) => {
            try {
              const isSlashed = await that.sfc.isSlashed(validatorID);
              expect(isSlashed).to.be.a('boolean');
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle slashingRefundRatio with random validatorIDs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          async (validatorID: bigint) => {
            try {
              const ratio = await that.sfc.slashingRefundRatio(validatorID);
              expect(ratio).to.be.a('bigint');
              expect(ratio).to.be.gte(0n);
              expect(ratio).to.be.lte(ethers.parseEther('1')); // Should not exceed 100%
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Staking-related Getters', function () {
    it('should handle getStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const stake = await that.sfc.getStake(delegator, validatorID);
              expect(stake).to.be.a('bigint');
              expect(stake).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getLockedStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const lockedStake = await that.sfc.getLockedStake(delegator, validatorID);
              expect(lockedStake).to.be.a('bigint');
              expect(lockedStake).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getUnlockedStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const unlockedStake = await that.sfc.getUnlockedStake(delegator, validatorID);
              expect(unlockedStake).to.be.a('bigint');
              expect(unlockedStake).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle isLockedUp with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const isLockedUp = await that.sfc.isLockedUp(delegator, validatorID);
              expect(isLockedUp).to.be.a('boolean');
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getLockupInfo with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const lockupInfo = await that.sfc.getLockupInfo(delegator, validatorID);
              expect(lockupInfo).to.have.length(4);
              expect(lockupInfo[0]).to.be.a('bigint'); // lockedStake
              expect(lockupInfo[1]).to.be.a('bigint'); // fromEpoch
              expect(lockupInfo[2]).to.be.a('bigint'); // endTime
              expect(lockupInfo[3]).to.be.a('bigint'); // duration
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Rewards-related Getters', function () {
    it('should handle pendingRewards with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const pendingRewards = await that.sfc.pendingRewards(delegator, validatorID);
              expect(pendingRewards).to.be.a('bigint');
              expect(pendingRewards).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle rewardsStash with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const rewardsStash = await that.sfc.rewardsStash(delegator, validatorID);
              expect(rewardsStash).to.be.a('bigint');
              expect(rewardsStash).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getStashedLockupRewards with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const rewards = await that.sfc.getStashedLockupRewards(delegator, validatorID);
              expect(rewards).to.have.length(3);
              expect(rewards[0]).to.be.a('bigint'); // lockupExtraReward
              expect(rewards[1]).to.be.a('bigint'); // lockupBaseReward
              expect(rewards[2]).to.be.a('bigint'); // unlockedReward
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle stashedRewardsUntilEpoch with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const epoch = await that.sfc.stashedRewardsUntilEpoch(delegator, validatorID);
              expect(epoch).to.be.a('bigint');
              expect(epoch).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Epoch-related Getters', function () {
    it('should handle getEpochSnapshot with random epochs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 1000n }),
          async (epoch: bigint) => {
            try {
              const snapshot = await that.sfc.getEpochSnapshot(epoch);
              expect(snapshot).to.have.length(7);
              expect(snapshot[0]).to.be.a('bigint'); // endTime
              expect(snapshot[1]).to.be.a('bigint'); // epochFee
              expect(snapshot[2]).to.be.a('bigint'); // totalBaseRewardWeight
              expect(snapshot[3]).to.be.a('bigint'); // totalTxRewardWeight
              expect(snapshot[4]).to.be.a('bigint'); // baseRewardPerSecond
              expect(snapshot[5]).to.be.a('bigint'); // totalStake
              expect(snapshot[6]).to.be.a('bigint'); // totalSupply
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochValidatorIDs with random epochs', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          async (epoch: bigint) => {
            try {
              const validatorIDs = await that.sfc.getEpochValidatorIDs(epoch);
              expect(Array.isArray(validatorIDs)).to.be.true;
              for (const id of validatorIDs) {
                expect(id).to.be.a('bigint');
                expect(id).to.be.gt(0n);
              }
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochReceivedStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const receivedStake = await that.sfc.getEpochReceivedStake(epoch, validatorID);
              expect(receivedStake).to.be.a('bigint');
              expect(receivedStake).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochAccumulatedRewardPerToken with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const rewardPerToken = await that.sfc.getEpochAccumulatedRewardPerToken(epoch, validatorID);
              expect(rewardPerToken).to.be.a('bigint');
              expect(rewardPerToken).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochAccumulatedUptime with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const uptime = await that.sfc.getEpochAccumulatedUptime(epoch, validatorID);
              expect(uptime).to.be.a('bigint');
              expect(uptime).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochAccumulatedOriginatedTxsFee with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const txsFee = await that.sfc.getEpochAccumulatedOriginatedTxsFee(epoch, validatorID);
              expect(txsFee).to.be.a('bigint');
              expect(txsFee).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochOfflineTime with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const offlineTime = await that.sfc.getEpochOfflineTime(epoch, validatorID);
              expect(offlineTime).to.be.a('bigint');
              expect(offlineTime).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle getEpochOfflineBlocks with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: 1n, max: 1000n }),
          async (epoch: bigint, validatorID: bigint) => {
            try {
              const offlineBlocks = await that.sfc.getEpochOfflineBlocks(epoch, validatorID);
              expect(offlineBlocks).to.be.a('bigint');
              expect(offlineBlocks).to.be.gte(0n);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Withdrawal-related Getters', function () {
    it('should handle getWithdrawalRequest with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 0n, max: 100n }),
          async (delegator: string, validatorID: bigint, wrID: bigint) => {
            try {
              const withdrawalRequest = await that.sfc.getWithdrawalRequest(delegator, validatorID, wrID);
              expect(withdrawalRequest).to.have.length(3);
              expect(withdrawalRequest[0]).to.be.a('bigint'); // epoch
              expect(withdrawalRequest[1]).to.be.a('bigint'); // time
              expect(withdrawalRequest[2]).to.be.a('bigint'); // amount
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Ownership and Version', function () {
    it('should return valid isOwner', async function () {
      await delay(100);

      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: that.signers.length - 1 }),
          validEthereumAddress(),
          async (signerIndex: number, newOwner: string) => {
            try {
              const signer = that.signers[signerIndex];
              const isOwner = await that.sfc.isOwner();
              return true;
            } catch (error: any) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      )
    });

    it('should return valid version', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const version = await that.sfc.version();
            expect(version).to.be.a('string');
            expect(version.length).to.equal(8); // "0x" + 3 bytes
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('Consistency Tests', function () {
    it('should maintain totalActiveStake <= totalStake', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const totalStake = await that.sfc.totalStake();
            const totalActiveStake = await that.sfc.totalActiveStake();
            expect(totalActiveStake).to.be.lte(totalStake);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should maintain lockedStake <= totalStake for any delegator', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 100n }),
          async (delegator: string, validatorID: bigint) => {
            try {
              const lockedStake = await that.sfc.getLockedStake(delegator, validatorID);
              const totalStake = await that.sfc.getStake(delegator, validatorID);
              expect(lockedStake).to.be.lte(totalStake);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should have currentEpoch = currentSealedEpoch + 1', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          try {
            const currentEpoch = await that.sfc.currentEpoch();
            const currentSealedEpoch = await that.sfc.currentSealedEpoch();
            expect(currentEpoch).to.equal(currentSealedEpoch + 1n);
            return true;
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
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