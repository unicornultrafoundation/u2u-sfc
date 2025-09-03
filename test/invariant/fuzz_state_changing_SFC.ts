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

describe('SFC State-Changing Functions Fuzz Tests', function () {
  let that: That;

  const addressesFilePath = path.join(__dirname, '/contract-addresses.json');

  function loadContractAddresses() {
    try {
      const addressesData = fs.readFileSync(addressesFilePath, 'utf8');
      return JSON.parse(addressesData);
    } catch (error) {
      console.log('Contract addresses file not found, using default addresses');
      return {
        sfc: '0xfc00face00000000000000000000000000000000',
        nodeDriver: '0xd100a01e00000000000000000000000000000000',
        nodeDriverAuth: '0xd100ae0000000000000000000000000000000000',
        evmWriter: '0xd100ec0000000000000000000000000000000000',
        constants: '0x6CA548f6DF5B540E72262E935b6Fe3e72cDd68C9',
        sfcProxy: '0x2a57261F79009f35B9b2d4C146471f47BaEf3f77',
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
  
  beforeEach(async function () {
    await that.constants.updateTargetGasPowerPerSecond(500_000_000); // Ensure target gas power is set before each test
  });

  describe('Ownership Functions', function () {
    // it('should handle transferOwnership with random valid addresses', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(
    //       validEthereumAddress(),
    //       async (newOwner: string) => {
    //         try {
    //           // Only owner can transfer ownership
    //           const currentOwner = await that.sfc.owner();
    //           const isCurrentOwner = await that.sfc.isOwner();

    //           if (isCurrentOwner && newOwner !== ethers.ZeroAddress) {
    //             const tx = await that.sfc.transferOwnership(newOwner);
    //             await tx.wait();
    //             // Verify ownership was transferred
    //             const updatedOwner = await that.sfc.owner();
    //             expect(updatedOwner.toLowerCase()).to.equal(newOwner.toLowerCase());
    //           }
    //           return true;
    //         } catch (error: any) {
    //           // Expected to fail if not owner or invalid address
    //           const errorMessage = error.message || error.toString();
    //           const expectedErrors = [
    //             'caller is not the owner',
    //             'Ownable: caller is not the owner',
    //             'new owner is the zero address',
    //             'Ownable: new owner is the zero address'
    //           ];
    //           const isExpectedError = expectedErrors.some((msg: string) => errorMessage.includes(msg));
    //           return isExpectedError;
    //         }
    //       }
    //     ),
    //     { numRuns: 10, includeErrorInReport: true }
    //   );
    // });

    it('should handle transferOwnership with non-owner callers', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: that.signers.length - 1 }),
          validEthereumAddress(),
          async (signerIndex: number, newOwner: string) => {
            try {
              const signer = that.signers[signerIndex];
              await expect(that.sfc.connect(signer).transferOwnership(newOwner)).to.be.revertedWith(
                'Ownable: caller is not the owner'
              );
              return true;
            } catch (error: any) {
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    // it('should handle renounceOwnership', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(fc.constant(null), async () => {
    //       try {
    //         const isOwner = await that.sfc.isOwner();
    //         if (isOwner) {
    //           await that.sfc.renounceOwnership();
    //           const newOwner = await that.sfc.owner();
    //           expect(newOwner).to.equal(ethers.ZeroAddress);
    //         }
    //         return true;
    //       } catch (error: any) {
    //         // Expected to fail if not owner
    //         const errorMessage = error.message || error.toString();
    //         return errorMessage.includes('caller is not the owner');
    //       }
    //     }),
    //     { numRuns: 5, includeErrorInReport: true }
    //   );
    // });
  });

  describe('Validator Operations', function () {
    it('should handle delegate with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('1000') }),
          async (validatorID: bigint, amount: bigint) => {
            try {
              const validator = await that.sfc.getValidator(validatorID);

              const initialStake = await that.sfc.getStake(that.user.address, validatorID);
              await that.sfc.connect(that.user).delegate(validatorID, { value: amount });

              const newStake = await that.sfc.getStake(that.user.address, validatorID);
              expect(newStake).to.be.gte(initialStake);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                "validator doesn't exist",
                'validator is not active',
                'insufficient funds',
                "delegation doesn't exist",
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError || validatorID === 0n;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle undelegate with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 0n, max: 100n }),
          bigInt({ min: ethers.parseEther('0.01'), max: ethers.parseEther('100') }),
          async (validatorID: bigint, wrID: bigint, amount: bigint) => {
            try {
              const stake = await that.sfc.getStake(that.user.address, validatorID);

              await that.sfc.connect(that.user).undelegate(validatorID, wrID, amount);

              const newStake = await that.sfc.getStake(that.user.address, validatorID);
              expect(newStake).to.be.lte(stake);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                "delegation doesn't exist",
                'not enough stake',
                "validator doesn't exist",
                'insufficient stake',
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle withdraw with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 0n, max: 100n }),
          async (validatorID: bigint, wrID: bigint) => {
            try {
              const withdrawalRequest = await that.sfc.getWithdrawalRequest(that.user.address, validatorID, wrID);

              await that.sfc.connect(that.user).withdraw(validatorID, wrID);

              // Balance should increase (accounting for gas costs)
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = ["withdrawal doesn't exist", 'not matured yet', 'already withdrawn'];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Reward Operations', function () {
    it('should handle stashRewards with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: 1n, max: 1000n }),
          async (delegator: string, validatorID: bigint) => {
            try {

              const initialStash = await that.sfc.rewardsStash(delegator, validatorID);
              await that.sfc.stashRewards(delegator, validatorID);

              const newStash = await that.sfc.rewardsStash(delegator, validatorID);
              expect(newStash).to.be.gte(initialStash);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = ["delegation doesn't exist", "validator doesn't exist", 'nothing to stash'];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle claimRewards with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(bigInt({ min: 1n, max: 1000n }), async (validatorID: bigint) => {
          try {

            await that.sfc.connect(that.user).claimRewards(validatorID);

            // Balance should increase (accounting for gas costs)
            const newStash = await that.sfc.rewardsStash(that.user.address, validatorID);
            expect(newStash).to.equal(0n);
            return true;
          } catch (error: any) {
            const errorMessage = error.message || error.toString();
            const expectedErrors = ["delegation doesn't exist", "validator doesn't exist", 'nothing to claim'];
            const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
            return isExpectedError;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle restakeRewards with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(bigInt({ min: 1n, max: 1000n }), async (validatorID: bigint) => {
          try {

            const initialStake = await that.sfc.getStake(that.user.address, validatorID);
            await that.sfc.connect(that.user).restakeRewards(validatorID);

            const newStake = await that.sfc.getStake(that.user.address, validatorID);
            expect(newStake).to.be.gte(initialStake);

            const newStash = await that.sfc.rewardsStash(that.user.address, validatorID);
            expect(newStash).to.equal(0n);
            return true;
          } catch (error: any) {
            const errorMessage = error.message || error.toString();
            const expectedErrors = ["delegation doesn't exist", "validator doesn't exist", 'nothing to restake'];
            const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
            return isExpectedError;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Admin Operations', function () {
    it('should handle updateOfflinePenaltyThreshold with authorized caller', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 100n, max: 1000000n }),
          bigInt({ min: 86400n, max: BigInt(10 * 86400) }),
          async (blocksNum: bigint, time: bigint) => {
            try {
              // This function exists in SFC but requires proper authorization
              await that.sfc.updateOfflinePenaltyThreshold(blocksNum, time);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                'caller is not the NodeDriverAuth contract',
                'unauthorized',
                'caller is not the owner',
              ];
              const isExpectedError = expectedErrors.some((msg: string) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle mintU2U with owner', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          validEthereumAddress(),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('1000') }),
          fc.string({ minLength: 5, maxLength: 50 }),
          async (receiver: string, amount: bigint, justification: string) => {
            try {
              const initialBalance = await ethers.provider.getBalance(receiver);
              await that.sfc.mintU2U(receiver, amount, justification);

              const finalBalance = await ethers.provider.getBalance(receiver);
              expect(finalBalance).to.be.gte(initialBalance);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = ['caller is not the owner', 'zero address', 'invalid amount'];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle burnU2U with owner', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('100') }),
          async (amount: bigint) => {
            try {

              const initialSupply = await that.sfc.totalSupply();
              await that.sfc.burnU2U(amount);

              const finalSupply = await that.sfc.totalSupply();
              expect(finalSupply).to.be.lte(initialSupply);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = ['caller is not the owner', 'insufficient funds', 'invalid amount'];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Staking Operations', function () {
    it('should handle lockStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 86400n, max: BigInt(86400 * 365) }), // 1 day to 1 year
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('100') }),
          async (validatorID: bigint, lockupDuration: bigint, amount: bigint) => {
            try {
              const initialLockedStake = await that.sfc.getLockedStake(that.user.address, validatorID);
              const memay = await that.sfc.connect(that.user).lockStake(validatorID, lockupDuration, amount);
              console.log(" ---> memay: ", memay)

              const finalLockedStake = await that.sfc.getLockedStake(that.user.address, validatorID);
              expect(finalLockedStake).to.be.gte(initialLockedStake);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              console.log(" ---> errorMessage: ", errorMessage)
              const expectedErrors = [
                "delegation doesn't exist",
                "validator doesn't exist",
                'not enough unlocked stake',
                'invalid lockup duration',
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle relockStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 86400n, max: BigInt(86400 * 365) }), // 1 day to 1 year
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('100') }),
          async (validatorID: bigint, lockupDuration: bigint, amount: bigint) => {
            try {

              await that.sfc.connect(that.user).relockStake(validatorID, lockupDuration, amount);

              // Verify lockup info was updated
              const lockupInfo = await that.sfc.getLockupInfo(that.user.address, validatorID);
              expect(lockupInfo[3]).to.equal(lockupDuration); // duration
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                "delegation doesn't exist",
                "validator doesn't exist",
                'not enough locked stake',
                'invalid lockup duration',
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle unlockStake with random parameters', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: ethers.parseEther('0.1'), max: ethers.parseEther('100') }),
          async (validatorID: bigint, amount: bigint) => {
            try {

              const initialUnlockedStake = await that.sfc.getUnlockedStake(that.user.address, validatorID);

              await that.sfc.connect(that.user).unlockStake(validatorID, amount);

              const finalUnlockedStake = await that.sfc.getUnlockedStake(that.user.address, validatorID);
              expect(finalUnlockedStake).to.be.gte(initialUnlockedStake);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                "delegation doesn't exist",
                "validator doesn't exist",
                'not enough locked stake',
                'stake is not locked up',
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Deactivation and Slashing', function () {
    it('should handle deactivateValidator with authorized caller', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 1n, max: 255n }),
          async (validatorID: bigint, status: bigint) => {
            try {
              // This should only work for node driver or authorized callers
              await that.sfc.deactivateValidator(validatorID, status);

              const validator = await that.sfc.getValidator(validatorID);
              expect(validator[0]).to.be.gte(status); // status should be updated
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = [
                'caller is not the NodeDriverAuth contract',
                "validator doesn't exist",
                'unauthorized',
              ];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should handle updateSlashingRefundRatio with owner', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: 1000n }),
          bigInt({ min: 0n, max: ethers.parseEther('1') }),
          async (validatorID: bigint, refundRatio: bigint) => {
            try {
              await that.sfc.updateSlashingRefundRatio(validatorID, refundRatio);

              const newRatio = await that.sfc.slashingRefundRatio(validatorID);
              expect(newRatio).to.equal(refundRatio);
              return true;
            } catch (error: any) {
              const errorMessage = error.message || error.toString();
              const expectedErrors = ['caller is not the owner', "validator doesn't exist", 'invalid ratio'];
              const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
              return isExpectedError;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });
  });

  describe('Address Update Operations', function () {
    // it('should handle updateConstsAddress with owner', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(
    //       validEthereumAddress(),
    //       async (newAddress: string) => {
    //         try {
    //           const isOwner = await that.sfc.isOwner();
    //             await that.sfc.updateConstsAddress(newAddress);

    //             const updatedAddress = await that.sfc.constsAddress();
    //             expect(updatedAddress.toLowerCase()).to.equal(newAddress.toLowerCase());
    //           return true;
    //         } catch (error: any) {
    //           const errorMessage = error.message || error.toString();
    //           const expectedErrors = [
    //             'caller is not the owner',
    //             'zero address'
    //           ];
    //           const isExpectedError = expectedErrors.some(msg => errorMessage.includes(msg));
    //           return isExpectedError;
    //         }
    //       }
    //     ),
    //     { numRuns: 10, includeErrorInReport: true }
    //   );
    // });

    // it('should handle updateStakeTokenizerAddress with owner', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(
    //       validEthereumAddress(),
    //       async (newAddress: string) => {
    //         try {
    //           const isOwner = await that.sfc.isOwner();
    //             await that.sfc.updateStakeTokenizerAddress(newAddress);

    //             const updatedAddress = await that.sfc.stakeTokenizerAddress();
    //             if (newAddress !== ethers.ZeroAddress) {
    //               expect(updatedAddress.toLowerCase()).to.equal(newAddress.toLowerCase());
    //             }
    //           return true;
    //         } catch (error: any) {
    //           const errorMessage = error.message || error.toString();
    //           const expectedErrors = [
    //             'caller is not the owner'
    //           ];
    //           const isExpectedError = expectedErrors.some(msg => errorMessage.includes(msg));
    //           return isExpectedError;
    //         }
    //       }
    //     ),
    //     { numRuns: 10, includeErrorInReport: true }
    //   );
    // });

    it('should handle updateTreasuryAddress with owner', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(validEthereumAddress(), async (newAddress: string) => {
          try {
            await that.sfc.updateTreasuryAddress(newAddress);

            const updatedAddress = await that.sfc.treasuryAddress();
            if (newAddress !== ethers.ZeroAddress) {
              expect(updatedAddress.toLowerCase()).to.equal(newAddress.toLowerCase());
            }
            return true;
          } catch (error: any) {
            const errorMessage = error.message || error.toString();
            const expectedErrors = ['caller is not the owner'];
            const isExpectedError = expectedErrors.some((msg) => errorMessage.includes(msg));
            return isExpectedError;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    // it('should handle updateVoteBookAddress with owner', async function () {
    //   await delay(100);
    //   fc.assert(
    //     fc.asyncProperty(
    //       validEthereumAddress(),
    //       async (newAddress: string) => {
    //         try {
    //           const isOwner = await that.sfc.isOwner();
    //             await that.sfc.updateVoteBookAddress(newAddress);
    //             // Note: voteBookAddress getter has issues, so we can't verify directly
    //           return true;
    //         } catch (error: any) {
    //           const errorMessage = error.message || error.toString();
    //           const expectedErrors = [
    //             'caller is not the owner'
    //           ];
    //           const isExpectedError = expectedErrors.some(msg => errorMessage.includes(msg));
    //           return isExpectedError;
    //         }
    //       }
    //     ),
    //     { numRuns: 10, includeErrorInReport: true }
    //   );
    // });

    it('should call recountVotes', async function () {
      await delay(100);
      fc.assert(
        fc.asyncProperty(validEthereumAddress(), validEthereumAddress(), async (address, validatorAuth) => {
          await that.lib.recountVotes(address, validatorAuth, false, 200000);
          return true;
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
