import fc, { bigInt } from 'fast-check';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';

import { SFCUnitTestI, NodeDriverAuth, NodeDriver, UnitTestConstantsManager, sfc, SFCI, ConstantsManager } from '../../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { BlockchainNode, ValidatorMetrics } from '../helpers/blockchain';
import { BigNumberish } from 'ethers';

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
  const fixture = async () => {
    const signers = await ethers.getSigners();
    const sfc = await ethers.getContractAt('SFCI', "0xfc00face00000000000000000000000000000000");
    const nodeDriver = await ethers.getContractAt('NodeDriver', "0xd100a01e00000000000000000000000000000000");
    const nodeDriverAuth = await ethers.getContractAt('NodeDriverAuth', "0xd100ae0000000000000000000000000000000000");
    const lib = await ethers.getContractAt('SFCLib', "0xfc01face00000000000000000000000000000000");
    const evmWriter = await ethers.getContractAt('EVMWriter', "0xd100ec0000000000000000000000000000000000");
    // const initializer = await ethers.deployContract('NetworkInitializer');
    // const node = new BlockchainNode(sfc);

    // await initializer.initializeAll(0, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, owner);
    const constants = await ethers.getContractAt('ConstantsManager', "0x6CA548f6DF5B540E72262E935b6Fe3e72cDd68C9");

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

  // describe('Node', () => {
  //   it('Should not migrate if not owner', async () => {
  //     await fc.assert(fc.asyncProperty(
  //       randomIndex(1, that.signers.length - 1),
  //       async (index) => {
  //         const randomSigner = that.signers[index];
  //         console.log(" ---> randomSigner: ", randomSigner.address)
  //         try {
  //           await expect(that.nodeDriverAuth.connect(randomSigner).migrateTo(randomSigner.address))
  //             .to.be.revertedWith('Ownable: caller is not the owner');

  //           return true;
  //         } catch (error) {
  //           console.log(" ---> error: ", error)
  //           // Handle cases where migrating to contract addresses is not allowed
  //           return false;
  //         }
  //       }
  //     ), { numRuns: 25 });
  //   });
  // });

  // ERROR: Out of gas error
  describe("Create Validator", function () {
    // it('Should create a validator', async () => {
    //   await fc.assert(fc.asyncProperty(
    //     randomIndex(1, that.signers.length - 1),
    //     async (index) => {
    //       try {
    //         const randomSigner = that.signers[index];
    //         const id = await that.sfc.getValidatorID(randomSigner.address);
    //         if (id !== 0n) {
    //           console.log(" Validator already exists for address: ", randomSigner.address);
    //           return true;
    //         }

    //         const tx = await that.sfc.connect(randomSigner).createValidator(randomSigner.address, {
    //           value: ethers.parseEther('1000000'),
    //         })

    //         await tx.wait();

    //         return true;
    //       } catch (error) {
    //         console.log(" ---> error: ", error)
    //         return false;
    //       }
    //     }
    //   ), { numRuns: 3, verbose: true });
    // });

    // it("Should delegate to a validator", async () => {
    //   await fc.assert(fc.asyncProperty(
    //     randomIndex(1, that.signers.length - 1),
    //     async (index) => {
    //       try {
    //         const randomSigner = that.signers[index];
    //         const id = await that.sfc.getValidatorID(randomSigner.address);
    //         if (id === 0n) {
    //           console.log(" Validator does not exist for address: ", randomSigner.address);
    //           return false;
    //         }

    //         const tx = await that.sfc.connect(that.user).delegate(id, {
    //           value: ethers.parseEther('10000'),
    //         });

    //         await tx.wait();

    //         return true;
    //       } catch (error) {
    //         console.log(" ---> error: ", error)
    //         return false;
    //       }
    //     }
    //   ), { numRuns: 3, verbose: true });
    // });
  })


  describe("Methods tests", function () {
    it('checking createValidator function', async () => {
      fc.assert(fc.asyncProperty(
        fc.integer({ min: 0, max: 499999 }),
        async (value) => {
          try {
            await expect(
              that.sfc.connect(that.user).createValidator(pubkey, {
                value: ethers.parseEther(value.toString()),
              })
            ).to.be.revertedWith('insufficient self-stake');
          } catch (error) {
            console.log(" ---> error: ", error)
            return false;
          }
        }), { numRuns: 10, verbose: true })


      fc.assert(fc.asyncProperty(
        fc.integer({ min: 500000, max: 999999999 }),
        async (value) => {
          try {
            await expect(
              that.sfc.connect(that.owner).createValidator(pubkey, {
                value: ethers.parseEther(value.toString()),
              })
            ).to.be.revertedWith('validator already exists');
          } catch (error) {
            console.log(" ---> error: ", error)
            return false;
          }
        }), {
        numRuns: 10,
        verbose: true
      })

      if (await that.sfc.getValidatorID(that.user.address) === 0n) {
        const tx = await that.sfc.connect(that.user).createValidator(pubkey, {
          value: ethers.parseEther('500000'),
        })

        await tx.wait();

        expect(await that.sfc.getValidatorID(that.user.address)).to.equal(1n);
      }

      const mm = await that.sfc.getValidator(1)
      const minSelfStake = await that.constants.minSelfStake()

      expect((await that.sfc.lastValidatorID()).toString()).to.equal('2');
      expect((await that.sfc.totalStake()).toString()).to.equal((ethers.parseEther('5000000') + minSelfStake).toString());

      const firstValidatorID = await that.sfc.getValidatorID(that.owner.address);
      const secondValidatorID = await that.sfc.getValidatorID(that.user.address);
      expect(firstValidatorID.toString()).to.equal('1');
      expect(secondValidatorID.toString()).to.equal('2');

      expect(await that.sfc.getValidatorPubkey(firstValidatorID)).to.equal(pubkey);
      expect(await that.sfc.getValidatorPubkey(secondValidatorID)).to.equal(pubkey);

      const firstValidatorObj = await that.sfc.getValidator(firstValidatorID);
      const secondValidatorObj = await that.sfc.getValidator(secondValidatorID);

      // Check first validator object
      expect(firstValidatorObj.receivedStake.toString()).to.equal(ethers.parseEther('5000000').toString());
      expect(firstValidatorObj.createdEpoch.toString()).to.equal('0');
      expect(firstValidatorObj.auth).to.equal(that.owner.address);
      expect(firstValidatorObj.status.toString()).to.equal('0');
      expect(firstValidatorObj.deactivatedTime.toString()).to.equal('0');
      expect(firstValidatorObj.deactivatedEpoch.toString()).to.equal('0');

      // Check second validator object
      expect(secondValidatorObj.receivedStake.toString()).to.equal(ethers.parseEther('500000').toString());
      expect(secondValidatorObj.auth).to.equal(that.user.address);
      expect(secondValidatorObj.status.toString()).to.equal('0');
      expect(secondValidatorObj.deactivatedTime.toString()).to.equal('0');
      expect(secondValidatorObj.deactivatedEpoch.toString()).to.equal('0');

      // Check created delegations
      expect(
        (await that.sfc.getStake(that.owner.address, firstValidatorID)).toString()
      ).to.equal(ethers.parseEther('5000000').toString());
      expect(
        (await that.sfc.getStake(that.user.address, secondValidatorID)).toString()
      ).to.equal(ethers.parseEther('500000').toString());
    });

    it('balances gas price', async () => {
      await that.constants.updateGasPriceBalancingCounterweight(24 * 60 * 60);
      await that.constants.updateTargetGasPowerPerSecond(1000000);
    })
  })
});

const validEthereumAddress = () => fc.string({
  minLength: 40,
  maxLength: 40,
  unit: fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f')
}).map(hex => '0x' + hex)
  .filter(addr => ethers.isAddress(addr)); // v6 syntax

export function deriveEthAddressFromKey(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

const randomIndex = (min: number, max: number) => {
  return fc.integer({ min, max: max - 1 });
}
const delay = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};