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
import { delay } from './utils';

const pubkey =
  '0xc0048d505c351f4837cec72bce6f4254f5e4bc3f2c9a4816841db64319eee8b714ef9173fbf66d039b782624713791840846b2788d4b65a425adeba85a4b57efe0cd';

// Code under test
const contains = (text: any, pattern: any) => text.indexOf(pattern) >= 0;

interface That {
  sfc: SFCI;
  nodeDriverAuth: NodeDriverAuth;
  signers: HardhatEthersSigner[];
  owner: HardhatEthersSigner;
  user: HardhatEthersSigner;
  nodeDriver: NodeDriver;
  constants: ConstantsManager;
}

describe('SFC', function () {
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
    await delay(200);
    const tx = await that.constants.updateTargetGasPowerPerSecond(500_000_000); // Ensure target gas power is set before each test
    await tx.wait();
  });

  describe('updateMinSelfStake', function () {
    it('should fail if value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('100000') }), // 1 ETH in wei
          async (value: any) => {
            await expect(that.constants.updateMinSelfStake(value)).to.be.revertedWith('too small value');
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('10000001') }), // 10 ETH in wei
          async (value: any) => {
            await expect(that.constants.updateMinSelfStake(value)).to.be.revertedWith('too large value');
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('1000000'); // 1M wei
            await expect(that.constants.connect(signer).updateMinSelfStake(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('100000'), max: ethers.parseEther('10000000') }), // 100k to 10M wei
          async (value: any) => {
            try {
              await that.constants.updateMinSelfStake(value);
              return true; // If no error, the test passes
            } catch (error) {
              return false; // If an error occurs, the test fails
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true, endOnFailure: true }
      );
    });
  });

  describe('updateMaxDelegatedRatio', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('1000'); // 1 wei
            await expect(that.constants.connect(signer).updateMaxDelegatedRatio(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('1') }), // 1 ETH in wei
          async (value: any) => {
            try {
              await expect(that.constants.updateMaxDelegatedRatio(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('32') }), // 32 ETH in wei
          async (value: any) => {
            try {
              await expect(that.constants.updateMaxDelegatedRatio(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false; // If an error occurs, the test fails
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true, verbose: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('1'), max: ethers.parseEther('31') }), // 1 to 31 ETH in wei
          async (value: any) => {
            try {
              await that.constants.updateMaxDelegatedRatio(value);
              return true; // If no error, the test passes
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false; // If an error occurs, the test fails
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true, verbose: true }
      );
    });
  });

  describe('updateValidatorCommission', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 1000; // 10%
            await expect(that.constants.connect(signer).updateValidatorCommission(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.5') + 1n }), // More than 100% in basis points
          async (value: any) => {
            try {
              await expect(that.constants.updateValidatorCommission(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false; // If an error occurs, the test fails
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true, verbose: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1n, max: ethers.parseEther('0.5') }), // Valid range for commission in basis points
          async (value: any) => {
            try {
              await that.constants.updateValidatorCommission(value);
              return true; // If no error, the test passes
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false; // If an error occurs, the test fails
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true, verbose: true }
      );
    });
  });

  describe('updateBurntFeeShare', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('0.1'); // 10%
            await expect(that.constants.connect(signer).updateBurntFeeShare(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.5') + 1n }), // More than 50%
          async (value: any) => {
            try {
              await expect(that.constants.updateBurntFeeShare(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('0.5') }), // 0% to 50%
          async (value: any) => {
            try {
              await that.constants.updateBurntFeeShare(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateTreasuryFeeShare', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('0.2'); // 20%
            await expect(that.constants.connect(signer).updateTreasuryFeeShare(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.5') + 1n }), // More than 50%
          async (value: any) => {
            try {
              await expect(that.constants.updateTreasuryFeeShare(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('0.5') }), // 0% to 50%
          async (value: any) => {
            try {
              await that.constants.updateTreasuryFeeShare(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateUnlockedRewardRatio', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('0.3'); // 30%
            await expect(that.constants.connect(signer).updateUnlockedRewardRatio(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('0.05') - 1n }), // Less than 5%
          async (value: any) => {
            try {
              await expect(that.constants.updateUnlockedRewardRatio(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.5') + 1n }), // More than 50%
          async (value: any) => {
            try {
              await expect(that.constants.updateUnlockedRewardRatio(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.05'), max: ethers.parseEther('0.5') }), // 5% to 50%
          async (value: any) => {
            try {
              await that.constants.updateUnlockedRewardRatio(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateMinLockupDuration', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 86400 * 7; // 1 week
            await expect(that.constants.connect(signer).updateMinLockupDuration(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 86399n }), // Less than 1 day
          async (value: any) => {
            try {
              await expect(that.constants.updateMinLockupDuration(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(86400 * 30 + 1) }), // More than 30 days
          async (value: any) => {
            try {
              await expect(that.constants.updateMinLockupDuration(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 86400n, max: BigInt(86400 * 30) }), // 1 to 30 days
          async (value: any) => {
            try {
              await that.constants.updateMinLockupDuration(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateMaxLockupDuration', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 86400 * 365; // 1 year
            await expect(that.constants.connect(signer).updateMaxLockupDuration(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: BigInt(86400 * 30 - 1) }), // Less than 30 days
          async (value: any) => {
            try {
              await expect(that.constants.updateMaxLockupDuration(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(86400 * 1460 + 1) }), // More than 4 years (1460 days)
          async (value: any) => {
            try {
              await expect(that.constants.updateMaxLockupDuration(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(86400 * 30), max: BigInt(86400 * 1460) }), // 30 days to 4 years
          async (value: any) => {
            try {
              await that.constants.updateMaxLockupDuration(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateWithdrawalPeriodEpochs', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 5;
            await expect(that.constants.connect(signer).updateWithdrawalPeriodEpochs(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 1n }), // Less than 2
          async (value: any) => {
            try {
              await expect(that.constants.updateWithdrawalPeriodEpochs(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 101n }), // More than 100
          async (value: any) => {
            try {
              await expect(that.constants.updateWithdrawalPeriodEpochs(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 2n, max: 100n }), // 2 to 100 epochs
          async (value: any) => {
            try {
              await that.constants.updateWithdrawalPeriodEpochs(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateWithdrawalPeriodTime', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 86400 * 7; // 1 week
            await expect(that.constants.connect(signer).updateWithdrawalPeriodTime(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 86399n }), // Less than 1 day
          async (value: any) => {
            try {
              await expect(that.constants.updateWithdrawalPeriodTime(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(30 * 86400 + 1) }), // More than 30 days
          async (value: any) => {
            try {
              await expect(that.constants.updateWithdrawalPeriodTime(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 86400n, max: BigInt(30 * 86400) }), // 1 to 30 days
          async (value: any) => {
            try {
              await that.constants.updateWithdrawalPeriodTime(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateBaseRewardPerSecond', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = ethers.parseEther('1'); // 1 U2U per second
            await expect(that.constants.connect(signer).updateBaseRewardPerSecond(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: ethers.parseEther('0.5') - 1n }), // Less than 0.5 U2U
          async (value: any) => {
            try {
              await expect(that.constants.updateBaseRewardPerSecond(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('32') + 1n }), // More than 32 U2U
          async (value: any) => {
            try {
              await expect(that.constants.updateBaseRewardPerSecond(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: ethers.parseEther('0.5'), max: ethers.parseEther('32') }), // 0.5 to 32 U2U
          async (value: any) => {
            try {
              await that.constants.updateBaseRewardPerSecond(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateOfflinePenaltyThresholdTime', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 86400 * 2; // 2 days
            await expect(that.constants.connect(signer).updateOfflinePenaltyThresholdTime(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 86399n }), // Less than 1 day
          async (value: any) => {
            try {
              await expect(that.constants.updateOfflinePenaltyThresholdTime(value)).to.be.revertedWith(
                'too small value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(10 * 86400 + 1) }), // More than 10 days
          async (value: any) => {
            try {
              await expect(that.constants.updateOfflinePenaltyThresholdTime(value)).to.be.revertedWith(
                'too large value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 86400n, max: BigInt(10 * 86400) }), // 1 to 10 days
          async (value: any) => {
            try {
              await that.constants.updateOfflinePenaltyThresholdTime(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateOfflinePenaltyThresholdBlocksNum', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 1000;
            await expect(
              that.constants.connect(signer).updateOfflinePenaltyThresholdBlocksNum(value)
            ).to.be.revertedWith('Ownable: caller is not the owner');
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 99n }), // Less than 100
          async (value: any) => {
            try {
              await expect(that.constants.updateOfflinePenaltyThresholdBlocksNum(value)).to.be.revertedWith(
                'too small value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1000001n }), // More than 1,000,000
          async (value: any) => {
            try {
              await expect(that.constants.updateOfflinePenaltyThresholdBlocksNum(value)).to.be.revertedWith(
                'too large value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 100n, max: 1000000n }), // 100 to 1,000,000 blocks
          async (value: any) => {
            try {
              await that.constants.updateOfflinePenaltyThresholdBlocksNum(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateTargetGasPowerPerSecond', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 10000000; // 10M gas
            await expect(that.constants.connect(signer).updateTargetGasPowerPerSecond(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 999999n }), // Less than 1,000,000
          async (value: any) => {
            try {
              await expect(that.constants.updateTargetGasPowerPerSecond(value)).to.be.revertedWith('too small value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 500000001n }), // More than 500,000,000
          async (value: any) => {
            try {
              await expect(that.constants.updateTargetGasPowerPerSecond(value)).to.be.revertedWith('too large value');
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 1000000n, max: 500000000n }), // 1M to 500M gas
          async (value: any) => {
            try {
              await that.constants.updateTargetGasPowerPerSecond(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });

  describe('updateGasPriceBalancingCounterweight', function () {
    it('should fail with non owner call', async function () {
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: that.signers.length - 1 }), async (index: any) => {
          try {
            const signer = that.signers[index];
            const value = 1000;
            await expect(that.constants.connect(signer).updateGasPriceBalancingCounterweight(value)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
          } catch (error) {
            // console.log(' ---> error: ', error);
            return false;
          }
        }),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too small', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 0n, max: 99n }), // Less than 100
          async (value: any) => {
            try {
              await expect(that.constants.updateGasPriceBalancingCounterweight(value)).to.be.revertedWith(
                'too small value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should fail with value too big', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: BigInt(10 * 86400 + 1) }), // More than 10 * 86400 (864,000)
          async (value: any) => {
            try {
              await expect(that.constants.updateGasPriceBalancingCounterweight(value)).to.be.revertedWith(
                'too large value'
              );
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 10, includeErrorInReport: true }
      );
    });

    it('should succeed with valid value', async function () {
      fc.assert(
        fc.asyncProperty(
          bigInt({ min: 100n, max: BigInt(10 * 86400) }), // 100 to 864,000
          async (value: any) => {
            try {
              await that.constants.updateGasPriceBalancingCounterweight(value);
              return true;
            } catch (error) {
              // console.log(' ---> error: ', error);
              return false;
            }
          }
        ),
        { numRuns: 5, includeErrorInReport: true }
      );
    });
  });
});