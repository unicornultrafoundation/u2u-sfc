import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { beforeEach } from 'mocha';

import { SFCUnitTestI, NodeDriverAuth, NodeDriver, UnitTestConstantsManager } from '../typechain-types'
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BlockchainNode } from "./helpers/blockchain";

const pubkey = '0x00a2941866e485442aa6b17d67d77f8a6c4580bb556894cc1618473eff1e18203d8cce50b563cf4c75e408886079b8f067069442ed52e2ac9e556baa3f8fcc525f';


interface That {
    sfc: SFCUnitTestI,
    nodeDriverAuth: NodeDriverAuth
    owner: HardhatEthersSigner,
    user: HardhatEthersSigner,
    nodeDriver: NodeDriver,
    constants: UnitTestConstantsManager
}

describe("SFC", function () {
    let that: That
    const fixture = async () => {
        const [owner, user] = await ethers.getSigners();
        const sfc = await ethers.getContractAt("SFCUnitTestI", await ethers.deployContract('UnitTestSFC'));
        const nodeDriver = await ethers.deployContract('NodeDriver')
        const nodeDriverAuth = await ethers.deployContract('NodeDriverAuth')
        const lib = await ethers.deployContract('UnitTestSFCLib');
        const evmWriter = await ethers.deployContract('StubEvmWriter');
        const initializer = await ethers.deployContract('NetworkInitializer');

        await initializer.initializeAll(0, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, owner);
        const constants = await ethers.getContractAt(
            'UnitTestConstantsManager',
            await sfc.constsAddress(),
        );

        return {
            owner,
            user,
            sfc,
            evmWriter,
            nodeDriver,
            nodeDriverAuth,
            constants,
            lib
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    });

    describe('Node', () => {
        it('Should migrate to New address', async () => {
            await that.nodeDriverAuth.connect(that.owner).migrateTo(that.owner);
        });

        it('Should not migrate if not owner', async () => {
            await expect(that.nodeDriverAuth.connect(that.user).migrateTo(that.user))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should not copyCode if not owner', async () => {
            await expect(that.nodeDriverAuth.connect(that.user).copyCode('0x0000000000000000000000000000000000000000', that.owner))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should copyCode', async () => {
            await that.nodeDriverAuth.connect(that.owner).copyCode('0x0000000000000000000000000000000000000000', that.owner);
        });

        it('Should update network version', async () => {
            await that.nodeDriverAuth.connect(that.owner).updateNetworkVersion(1);
        });

        it('Should not update network version if not owner', async () => {
            await expect(that.nodeDriverAuth.connect(that.user).updateNetworkVersion(1))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should advance epoch', async () => {
            await that.nodeDriverAuth.connect(that.owner).advanceEpochs(1);
        });

        it('Should not set a new storage if not backend address', async () => {
            await expect(that.nodeDriver.connect(that.user).setStorage(
                that.user.address,
                ethers.keccak256(ethers.toUtf8Bytes('testKey')),
                ethers.keccak256(ethers.toUtf8Bytes('testValue'))
            )).to.be.revertedWith('caller is not the backend');
        });

        it('Should not advance epoch if not owner', async () => {
            await expect(that.nodeDriverAuth.connect(that.user).advanceEpochs(1))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('Should not set backend if not backend address', async () => {
            await expect(that.nodeDriver.connect(that.user).setBackend('0x0000000000000000000000000000000000000000'))
                .to.be.revertedWith('caller is not the backend');
        });

        it('Should not swap code if not backend address', async () => {
            await expect(that.nodeDriver.connect(that.user).swapCode(
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000'
            )).to.be.revertedWith('caller is not the backend');
        });

        it('Should not add a Genesis Validator through NodeDriver if not called by Node', async () => {
            await expect(that.nodeDriver.connect(that.user).setGenesisValidator(
                that.owner.address,
                1,
                ethers.randomBytes(32),
                0,
                await that.sfc.currentEpoch(),
                Date.now(),
                0,
                0
            )).to.be.revertedWith('not callable');
        });

        it('Should not deactivate a validator through NodeDriver if not called by Node', async () => {
            await expect(that.nodeDriver.connect(that.user).deactivateValidator(0, 1))
                .to.be.revertedWith('not callable');
        });

        it('Should not add a Genesis Delegation through NodeDriver if not called by Node', async () => {
            await expect(that.nodeDriver.connect(that.user).setGenesisDelegation(
                that.user.address,
                1,
                100,
                0,
                0,
                0,
                0,
                0,
                1000
            )).to.be.revertedWith('not callable');
        });

        it('Should not seal Epoch Validators through NodeDriver if not called by Node', async () => {
            await expect(that.nodeDriver.connect(that.user).sealEpochValidators([0, 1]))
                .to.be.revertedWith('not callable');
        });

        it('Should not seal Epoch through NodeDriver if not called by Node', async () => {
            await expect(that.nodeDriver.connect(that.user).sealEpoch(
                [0, 1],
                [0, 1],
                [0, 1],
                [0, 1]
            )).to.be.revertedWith('not callable');

            await expect(that.nodeDriver.connect(that.user).sealEpochV1(
                [0, 1],
                [0, 1],
                [0, 1],
                [0, 1],
                0
            )).to.be.revertedWith('not callable');
        });
    });


    describe('Genesis Validator', () => {
        beforeEach(async () => {
            // Bật chức năng NonNodeCalls để set Genesis Validator
            await that.sfc.connect(that.owner).enableNonNodeCalls();
            await expect(
                that.sfc.connect(that.owner).setGenesisValidator(
                    that.owner.address,
                    1,
                    pubkey,
                    1 << 3,
                    await that.sfc.currentEpoch(),
                    Date.now(),
                    0,
                    0
                )
            ).to.not.be.reverted; // Đảm bảo không có lỗi xảy ra
            // Tắt chức năng NonNodeCalls sau khi thiết lập
            await that.sfc.connect(that.owner).disableNonNodeCalls();
        });

        it('Set Genesis Validator with bad Status', async () => {
            // Kiểm tra đồng bộ Validator
            await expect(that.sfc.connect(that.owner)._syncValidator(1, false))
                .to.not.be.reverted;
        });

        it('should reject sealEpoch if not called by Node', async () => {
            // Kiểm tra lỗi khi gọi sealEpoch không phải từ Node
            await expect(
                that.sfc.connect(that.owner).sealEpoch(
                    [1],
                    [1],
                    [1],
                    [1],
                    0
                )
            ).to.be.revertedWith('caller is not the NodeDriverAuth contract');
        });

        it('should reject SealEpochValidators if not called by Node', async () => {
            // Kiểm tra lỗi khi gọi sealEpochValidators không phải từ Node
            await expect(
                that.sfc.connect(that.owner).sealEpochValidators([1])
            ).to.be.revertedWith('caller is not the NodeDriverAuth contract');
        });
    });

});

describe("SFC", function () {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        node: BlockchainNode
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator] = await ethers.getSigners();
        const sfc = await ethers.getContractAt("SFCUnitTestI", await ethers.deployContract('UnitTestSFC'));
        const nodeDriver = await ethers.deployContract('NodeDriver')
        const nodeDriverAuth = await ethers.deployContract('NodeDriverAuth')
        const lib = await ethers.deployContract('UnitTestSFCLib');
        const evmWriter = await ethers.deployContract('StubEvmWriter');
        const initializer = await ethers.deployContract('UnitTestNetworkInitializer');

        await initializer.initializeAll(0, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, firstValidator);
        const constants = await ethers.getContractAt(
            'UnitTestConstantsManager',
            await sfc.constsAddress(),
        );
        await sfc.rebaseTime();
        const node = new BlockchainNode(sfc);
        return {
            owner: firstValidator,
            user: secondValidator,
            firstValidator,
            secondValidator,
            thirdValidator,
            sfc,
            evmWriter,
            nodeDriver,
            nodeDriverAuth,
            constants,
            lib,
            node
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    });


    describe('Basic functions', () => {
        describe('Constants', () => {
            it('Returns current Epoch', async () => {
                expect((await that.sfc.currentEpoch()).toString()).to.equal('1');
            });

            it('Returns minimum amount to stake for a Validator', async () => {
                expect((await that.constants.minSelfStake()).toString()).to.equal('317500000000000000');
            });

            it('Returns the maximum ratio of delegations a validator can have', async () => {
                expect((await that.constants.maxDelegatedRatio()).toString()).to.equal('16000000000000000000');
            });

            it('Returns commission fee in percentage a validator will get from a delegation', async () => {
                expect((await that.constants.validatorCommission()).toString()).to.equal('150000000000000000');
            });

            it('Returns burntFeeShare', async () => {
                expect((await that.constants.burntFeeShare()).toString()).to.equal('200000000000000000');
            });

            it('Returns treasuryFeeShare', async () => {
                expect((await that.constants.treasuryFeeShare()).toString()).to.equal('100000000000000000');
            });

            it('Returns the ratio of the reward rate at base rate (without lockup)', async () => {
                expect((await that.constants.unlockedRewardRatio()).toString()).to.equal('300000000000000000');
            });

            it('Returns the minimum duration of a stake/delegation lockup', async () => {
                expect((await that.constants.minLockupDuration()).toString()).to.equal('1209600');
            });

            it('Returns the maximum duration of a stake/delegation lockup', async () => {
                expect((await that.constants.maxLockupDuration()).toString()).to.equal('31536000');
            });

            it('Returns the period of time that stake is locked', async () => {
                expect((await that.constants.withdrawalPeriodTime()).toString()).to.equal('604800');
            });

            it('Returns the number of epochs that stake is locked', async () => {
                expect((await that.constants.withdrawalPeriodEpochs()).toString()).to.equal('3');
            });

            it('Returns the version of the current implementation', async () => {
                expect((await that.sfc.version()).toString()).to.equal('0x333034');
            });

            // it('Reverts on transfers', async () => {
            //     await expect(that.sfc.connect(thatsecondValidator).sendTransaction({ value: 1 }))
            //         .to.be.revertedWith('transfers not allowed');
            // });

            it('Should create a Validator and return the ID', async () => {
                await that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                    value: ethers.parseEther('10'),
                });
                const lastValidatorID = await that.sfc.lastValidatorID();
                expect(lastValidatorID.toString()).to.equal('1');
            });

            it('Should fail to create a Validator with insufficient self-stake', async () => {
                await expect(that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                    value: 1,
                })).to.be.revertedWith('insufficient self-stake');
            });

            it('Should fail if pubkey is empty', async () => {
                await expect(that.sfc.connect(that.secondValidator).createValidator('0x', {
                    value: ethers.parseEther('10'),
                })).to.be.revertedWith('empty pubkey');
            });

            it('Should create two Validators and return the correct last validator ID', async () => {
                await that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                    value: ethers.parseEther('10'),
                });
                let lastValidatorID = await that.sfc.lastValidatorID();
                expect(lastValidatorID.toString()).to.equal('1');

                await that.sfc.connect(that.thirdValidator).createValidator(pubkey, {
                    value: ethers.parseEther('12'),
                });
                lastValidatorID = await that.sfc.lastValidatorID();
                expect(lastValidatorID.toString()).to.equal('2');
            });

            it('Should return current Sealed Epoch', async () => {
                expect((await that.sfc.currentSealedEpoch()).toString()).to.equal('0');
            });

            it('Should return getTime()', async () => {
                const now = (await ethers.provider.getBlock('latest'))?.timestamp || 0;
                expect((await that.sfc.getTime())).to.be.within(now - 100, now + 100);
            });
        });
    });

})


describe("SFC", function () {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
        const sfc = await ethers.getContractAt("SFCUnitTestI", await ethers.deployContract('UnitTestSFC'));
        const nodeDriver = await ethers.deployContract('NodeDriver')
        const nodeDriverAuth = await ethers.deployContract('NodeDriverAuth')
        const lib = await ethers.deployContract('UnitTestSFCLib');
        const evmWriter = await ethers.deployContract('StubEvmWriter');
        const initializer = await ethers.deployContract('UnitTestNetworkInitializer');

        await initializer.initializeAll(10, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, firstValidator);
        const constants = await ethers.getContractAt(
            'UnitTestConstantsManager',
            await sfc.constsAddress(),
        );
        await sfc.rebaseTime();
        const node = new BlockchainNode(sfc);
        return {
            owner: firstValidator,
            user: secondValidator,
            firstValidator,
            secondValidator,
            thirdValidator,
            sfc,
            evmWriter,
            nodeDriver,
            nodeDriverAuth,
            constants,
            lib,
            node,
            firstDelegator,
            secondDelegator,
            thirdDelegator
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    describe('Create validators', () => {
        it('Should create Validators', async () => {
            await expect(that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            })).to.not.be.reverted;

            await expect(that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                value: ethers.parseEther('15'),
            })).to.not.be.reverted;

            await expect(that.sfc.connect(that.thirdValidator).createValidator(pubkey, {
                value: ethers.parseEther('20'),
            })).to.not.be.reverted;
        });

        it('Should return the right ValidatorID by calling getValidatorID', async () => {
            expect((await that.sfc.getValidatorID(that.firstValidator.address)).toString()).to.equal('0');
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            });
            expect((await that.sfc.getValidatorID(that.firstValidator.address)).toString()).to.equal('1');
        });

        it('Should not be able to stake if Validator not created yet', async () => {
            await expect(that.sfc.connect(that.firstDelegator).delegate(1, {
                value: ethers.parseEther('10'),
            })).to.be.revertedWith('validator doesn\'t exist');

            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            });

            await expect(that.sfc.connect(that.secondDelegator).delegate(2, {
                value: ethers.parseEther('10'),
            })).to.be.revertedWith('validator doesn\'t exist');
        });

        it('Should stake with different delegators', async () => {
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            });
            await expect(that.sfc.connect(that.firstDelegator).delegate(1, {
                value: ethers.parseEther('11'),
            })).to.not.be.reverted;

            await that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                value: ethers.parseEther('15'),
            });
            await expect(that.sfc.connect(that.secondDelegator).delegate(2, {
                value: ethers.parseEther('10'),
            })).to.not.be.reverted;

            await that.sfc.connect(that.thirdValidator).createValidator(pubkey, {
                value: ethers.parseEther('20'),
            });
            await expect(that.sfc.connect(that.thirdDelegator).delegate(3, {
                value: ethers.parseEther('10'),
            })).to.not.be.reverted;
        });

        it('Should return the amount of delegated for each Delegator', async () => {
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            });
            await that.sfc.connect(that.firstDelegator).delegate(1, {
                value: ethers.parseEther('11'),
            });
            const stake = await that.sfc.getStake(that.firstDelegator.address, await that.sfc.getValidatorID(that.firstValidator.address));
            expect(stake.toString()).to.equal('11000000000000000000');
        });

        it('Should return the total of received Stake', async () => {
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            });
            await that.sfc.connect(that.firstDelegator).delegate(1, { value: ethers.parseEther('11') });
            await that.sfc.connect(that.secondDelegator).delegate(1, { value: ethers.parseEther('8') });
            await that.sfc.connect(that.thirdDelegator).delegate(1, { value: ethers.parseEther('8') });

            const validator = await that.sfc.getValidator(1);
            expect(validator.receivedStake.toString()).to.equal('37000000000000000000');
        });
    });

})