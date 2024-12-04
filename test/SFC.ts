import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { beforeEach } from 'mocha';

import { SFCUnitTestI, NodeDriverAuth, NodeDriver, UnitTestConstantsManager, sfc } from '../typechain-types'
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BlockchainNode, ValidatorMetrics } from "./helpers/blockchain";
import { BigNumberish } from "ethers";

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

describe("Basic Functions", function () {
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

})


describe("Create Validator", function () {
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
})


describe("Returns Validator", function () {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        validator: any
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
        const sfc = await ethers.getContractAt("SFCUnitTestI", await ethers.deployContract('UnitTestSFC'));
        const nodeDriver = await ethers.deployContract('NodeDriver')
        const nodeDriverAuth = await ethers.deployContract('NodeDriverAuth')
        const lib = await ethers.deployContract('UnitTestSFCLib');
        const evmWriter = await ethers.deployContract('StubEvmWriter');
        const initializer = await ethers.deployContract('UnitTestNetworkInitializer');

        await initializer.initializeAll(12, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, firstValidator);
        const constants = await ethers.getContractAt(
            'UnitTestConstantsManager',
            await sfc.constsAddress(),
        );
        await sfc.rebaseTime();
        const node = new BlockchainNode(sfc);

        await expect(
            sfc.connect(firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            })
        ).to.not.be.reverted;

        await sfc.connect(firstDelegator).delegate(1, {
            value: ethers.parseEther('11'),
        });

        await sfc.connect(secondDelegator).delegate(1, {
            value: ethers.parseEther('8'),
        });

        await sfc.connect(thirdDelegator).delegate(1, {
            value: ethers.parseEther('8'),
        });

        const validator = await sfc.getValidator(1);


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
            thirdDelegator,
            validator
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Should return Validator\'s status', async () => {
        expect(that.validator.status.toString()).to.equal('0');
    });

    it('Should return Validator\'s Deactivated Time', async () => {
        expect(that.validator.deactivatedTime.toString()).to.equal('0');
    });

    it('Should return Validator\'s Deactivated Epoch', async () => {
        expect(that.validator.deactivatedEpoch.toString()).to.equal('0');
    });

    it('Should return Validator\'s Received Stake', async () => {
        expect(that.validator.receivedStake.toString()).to.equal('37000000000000000000');
    });

    it('Should return Validator\'s Created Epoch', async () => {
        expect(that.validator.createdEpoch.toString()).to.equal('13');
    });

    it('Should return Validator\'s Created Time', async () => {
        const block = await ethers.provider.getBlock('latest');
        const now = block?.timestamp || 0;
        expect(that.validator.createdTime).to.be.within(now - 5, now + 5);
    });

    it('Should return Validator\'s Auth (address)', async () => {
        expect(that.validator.auth.toLowerCase()).to.equal(that.firstValidator.address.toLowerCase());
    });
})


describe('EpochSnapshot', () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        validator: any
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
        const sfc = await ethers.getContractAt("SFCUnitTestI", await ethers.deployContract('UnitTestSFC'));
        const nodeDriver = await ethers.deployContract('NodeDriver')
        const nodeDriverAuth = await ethers.deployContract('NodeDriverAuth')
        const lib = await ethers.deployContract('UnitTestSFCLib');
        const evmWriter = await ethers.deployContract('StubEvmWriter');
        const initializer = await ethers.deployContract('UnitTestNetworkInitializer');

        await initializer.initializeAll(12, 0, sfc, lib, nodeDriverAuth, nodeDriver, evmWriter, firstValidator);
        const constants = await ethers.getContractAt(
            'UnitTestConstantsManager',
            await sfc.constsAddress(),
        );
        await sfc.rebaseTime();
        await sfc.enableNonNodeCalls();
        const node = new BlockchainNode(sfc);

        await expect(
            sfc.connect(firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('10'),
            })
        ).to.not.be.reverted;

        await sfc.connect(firstDelegator).delegate(1, {
            value: ethers.parseEther('11'),
        });

        await sfc.connect(secondDelegator).delegate(1, {
            value: ethers.parseEther('8'),
        });

        await sfc.connect(thirdDelegator).delegate(1, {
            value: ethers.parseEther('8'),
        });

        const validator = await sfc.getValidator(1);


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
            thirdDelegator,
            validator
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Returns stashedRewardsUntilEpoch', async () => {
        expect((await that.sfc.currentSealedEpoch()).toString()).to.equal('12');
        expect((await that.sfc.currentEpoch()).toString()).to.equal('13');

        await that.sfc.sealEpoch(
            [100, 101, 102],
            [100, 101, 102],
            [100, 101, 102],
            [100, 101, 102],
            0
        );

        expect((await that.sfc.currentSealedEpoch()).toString()).to.equal('13');
        expect((await that.sfc.currentEpoch()).toString()).to.equal('14');

        for (let i = 0; i < 4; i++) {
            await that.sfc.sealEpoch(
                [100, 101, 102],
                [100, 101, 102],
                [100, 101, 102],
                [100, 101, 102],
                0
            );
        }

        expect((await that.sfc.currentSealedEpoch()).toString()).to.equal('17');
        expect((await that.sfc.currentEpoch()).toString()).to.equal('18');
    });
});

describe('Methods tests', async () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
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
        await sfc.enableNonNodeCalls();
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
            thirdDelegator,
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('checking createValidator function', async () => {
        expect((await that.sfc.lastValidatorID()).toString()).to.equal('0');

        await expect(
            that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.3174'),
            })
        ).to.be.revertedWith('insufficient self-stake');

        await that.node.handleTx(
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.3175'),
            })
        );

        await expect(
            that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.3175'),
            })
        ).to.be.revertedWith('validator already exists');

        await that.node.handleTx(
            await that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.5'),
            })
        );

        expect((await that.sfc.lastValidatorID()).toString()).to.equal('2');
        expect((await that.sfc.totalStake()).toString()).to.equal(ethers.parseEther('0.8175').toString());

        const firstValidatorID = await that.sfc.getValidatorID(that.firstValidator.address);
        const secondValidatorID = await that.sfc.getValidatorID(that.secondValidator.address);
        expect(firstValidatorID.toString()).to.equal('1');
        expect(secondValidatorID.toString()).to.equal('2');

        expect(await that.sfc.getValidatorPubkey(firstValidatorID)).to.equal(pubkey);
        expect(await that.sfc.getValidatorPubkey(secondValidatorID)).to.equal(pubkey);

        const firstValidatorObj = await that.sfc.getValidator(firstValidatorID);
        const secondValidatorObj = await that.sfc.getValidator(secondValidatorID);

        // Check first validator object
        expect(firstValidatorObj.receivedStake.toString()).to.equal(ethers.parseEther('0.3175').toString());
        expect(firstValidatorObj.createdEpoch.toString()).to.equal('11');
        expect(firstValidatorObj.auth).to.equal(that.firstValidator.address);
        expect(firstValidatorObj.status.toString()).to.equal('0');
        expect(firstValidatorObj.deactivatedTime.toString()).to.equal('0');
        expect(firstValidatorObj.deactivatedEpoch.toString()).to.equal('0');

        // Check second validator object
        expect(secondValidatorObj.receivedStake.toString()).to.equal(ethers.parseEther('0.5').toString());
        expect(secondValidatorObj.createdEpoch.toString()).to.equal('11');
        expect(secondValidatorObj.auth).to.equal(that.secondValidator.address);
        expect(secondValidatorObj.status.toString()).to.equal('0');
        expect(secondValidatorObj.deactivatedTime.toString()).to.equal('0');
        expect(secondValidatorObj.deactivatedEpoch.toString()).to.equal('0');

        // Check created delegations
        expect(
            (await that.sfc.getStake(that.firstValidator.address, firstValidatorID)).toString()
        ).to.equal(ethers.parseEther('0.3175').toString());
        expect(
            (await that.sfc.getStake(that.secondValidator.address, secondValidatorID)).toString()
        ).to.equal(ethers.parseEther('0.5').toString());
        // Check node-related logs
        expect(that.node.nextValidatorWeights.size).to.equal(2);
        expect(that.node.nextValidatorWeights.get(1n)?.toString()).to.equal(
            ethers.parseEther('0.3175').toString()
        );
        expect(that.node.nextValidatorWeights.get(2n)?.toString()).to.equal(
            ethers.parseEther('0.5').toString()
        );
    });

    it('checking sealing epoch', async () => {
        await that.node.handleTx(
            await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.3175'),
            })
        );
        await that.node.handleTx(
            await that.sfc.connect(that.secondValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.6825'),
            })
        );

        await that.node.sealEpoch(100);

        const firstValidatorID = await that.sfc.getValidatorID(that.firstValidator.address);
        const secondValidatorID = await that.sfc.getValidatorID(that.secondValidator.address);
        expect(firstValidatorID.toString()).to.equal('1');
        expect(secondValidatorID.toString()).to.equal('2');

        // const firstValidatorObj = await that.sfc.getValidator(firstValidatorID);
        // const secondValidatorObj = await that.sfc.getValidator(secondValidatorID);

        await that.node.handleTx(
            await that.sfc.connect(that.firstValidator).delegate(firstValidatorID, {
                value: ethers.parseEther('0.1'),
            })
        );
        await that.node.handleTx(
            await that.sfc.connect(that.thirdValidator).createValidator(pubkey, {
                value: ethers.parseEther('0.4'),
            })
        );

        const thirdValidatorID = await that.sfc.getValidatorID(that.thirdValidator.address);

        // Check node-related logs
        expect(that.node.validatorWeights.size).to.equal(2);
        expect(that.node.validatorWeights.get(firstValidatorID)).to.equal(
            ethers.parseEther('0.3175').toString()
        );
        expect(that.node.validatorWeights.get(secondValidatorID)).to.equal(
            ethers.parseEther('0.6825').toString()
        );
        expect(that.node.nextValidatorWeights.size).to.equal(3);
        expect(that.node.nextValidatorWeights.get(firstValidatorID)).to.equal(
            ethers.parseEther('0.4175').toString()
        );
        expect(that.node.nextValidatorWeights.get(secondValidatorID)).to.equal(
            ethers.parseEther('0.6825').toString()
        );
        expect(that.node.nextValidatorWeights.get(thirdValidatorID)).to.equal(
            ethers.parseEther('0.4').toString()
        );
    });


    it('balances gas price', async () => {
        await that.constants.updateGasPriceBalancingCounterweight(24 * 60 * 60);
        await that.sfc.rebaseTime();

        await that.sfc.connect(that.firstValidator).createValidator(pubkey, {
            value: ethers.parseEther('1.0'),
        });

        await that.constants.updateTargetGasPowerPerSecond(1000);

        await that.sfc.sealEpoch([1], [1], [1], [1], 1000);
        await that.sfc.sealEpochValidators([1]);

        expect((await that.sfc.minGasPrice()).toString()).to.equal('95000000000');

        await that.sfc.advanceTime(1);
        await that.sfc.sealEpoch([1], [1], [1], [1], 1000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94999998901');

        await that.sfc.advanceTime(2);
        await that.sfc.sealEpoch([1], [1], [1], [1], 2000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94999997802');

        await that.sfc.advanceTime(1000);
        await that.sfc.sealEpoch([1], [1], [1], [1], 1000000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94999996715');

        await that.sfc.advanceTime(1000);
        await that.sfc.sealEpoch([1], [1], [1], [1], 666666);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94637676437');

        await that.sfc.advanceTime(1000);
        await that.sfc.sealEpoch([1], [1], [1], [1], 1500000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('95179080284');

        await that.sfc.advanceTime(1);
        await that.sfc.sealEpoch([1], [1], [1], [1], 666);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('95178711617');

        await that.sfc.advanceTime(1);
        await that.sfc.sealEpoch([1], [1], [1], [1], 1500);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('95179260762');

        await that.sfc.advanceTime(1000);
        await that.sfc.sealEpoch([1], [1], [1], [1], 10000000000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('99938223800');

        await that.sfc.advanceTime(10000);
        await that.sfc.sealEpoch([1], [1], [1], [1], 0);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94941312610');

        await that.sfc.advanceTime(100);
        await that.sfc.sealEpoch([1], [1], [1], [1], 200000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('95051069157');

        await that.sfc.advanceTime(100);
        await that.sfc.sealEpoch([1], [1], [1], [1], 50000);
        await that.sfc.sealEpochValidators([1]);
        expect((await that.sfc.minGasPrice()).toString()).to.equal('94996125793');
    });
})

describe("Staking / Sealed", () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        firstValidatorID: bigint,
        secondValidatorID: bigint,
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
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
        await sfc.enableNonNodeCalls();

        const node = new BlockchainNode(sfc);


        // Create first validator
        await node.handleTx(await sfc.connect(firstValidator).createValidator(pubkey, {
            value: ethers.parseEther('0.4'),
        }));
        const firstValidatorID = await sfc.getValidatorID(firstValidator.address);
        
        // Create second validator
        await node.handleTx(await sfc.connect(secondValidator).createValidator(pubkey, {
            value: ethers.parseEther('0.8'),
        }));
        const secondValidatorID = await sfc.getValidatorID(secondValidator.address);
        
        // Create third validator
        await node.handleTx(await sfc.connect(thirdValidator).createValidator(pubkey, {
            value: ethers.parseEther('0.8'),
        }));
        const thirdValidatorID = await sfc.getValidatorID(thirdValidator.address);
        
        // Delegate stakes
        await sfc.connect(firstValidator).delegate(firstValidatorID, {
            value: ethers.parseEther('0.4'),
        });
        
        await sfc.connect(firstDelegator).delegate(firstValidatorID, {
            value: ethers.parseEther('0.4'),
        });
        
        await sfc.connect(secondDelegator).delegate(secondValidatorID, {
            value: ethers.parseEther('0.4'),
        });
        
        // Seal the epoch
        
        // Initialize BlockchainNode
        await node.sealEpoch(0);

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
            thirdDelegator,
            firstValidatorID,
            secondValidatorID
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    describe('Staking / Sealed Epoch functions', () => {
        it('Should return claimed Rewards until Epoch', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
            await that.node.sealEpoch(60 * 60 * 24);
            await that.node.sealEpoch(60 * 60 * 24);
    
            expect(await that.sfc.stashedRewardsUntilEpoch(that.firstDelegator.address, 1)).to.equal(0);
            await that.sfc.connect(that.firstDelegator).claimRewards(1);
            expect(await that.sfc.stashedRewardsUntilEpoch(that.firstDelegator.address, 1)).to.equal(await that.sfc.currentSealedEpoch());
        });
    
        it('Check pending Rewards of delegators', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('0');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('0');
    
            await that.node.sealEpoch(60 * 60 * 24);
    
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('6966');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('2754');
        });
    
        it('Check if pending Rewards have been increased after sealing Epoch', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            await that.node.sealEpoch(60 * 60 * 24);
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('6966');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('2754');
    
            await that.node.sealEpoch(60 * 60 * 24);
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('13932');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('5508');
        });
    
        it('Should increase balances after claiming Rewards', async () => {
            await that.constants.updateBaseRewardPerSecond(100000000000000n);
    
            await that.node.sealEpoch(0);
            await that.node.sealEpoch(60 * 60 * 24);
    
            const firstDelegatorPendingRewards = await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID);
            expect(firstDelegatorPendingRewards).to.equal(ethers.parseEther('0.2754'));
            const firstDelegatorBalance = await ethers.provider.getBalance(that.firstDelegator.address);
    
            await that.sfc.connect(that.firstDelegator).claimRewards(1);
    
            const newDelegatorBalance = await ethers.provider.getBalance(that.firstDelegator.address);
            expect(newDelegatorBalance- firstDelegatorBalance).to.be.closeTo(
                firstDelegatorPendingRewards.toString(),
                ethers.parseEther('0.01').toString()
            );
        });
    
        it('Should increase locked stake after restaking Rewards', async () => {
            await that.sfc.connect(that.firstValidator).lockStake(that.firstValidatorID, 86400 * 219 + 10, ethers.parseEther('0.2'));
            await that.sfc.connect(that.firstDelegator).lockStake(that.firstValidatorID, 86400 * 219, ethers.parseEther('0.2'));
    
            await that.constants.updateBaseRewardPerSecond(1);
    
            await that.node.sealEpoch(0);
            await that.node.sealEpoch(60 * 60 * 24);
    
            const firstDelegatorPendingRewards = await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID);
            expect(firstDelegatorPendingRewards).to.equal('4681');
            const firstDelegatorPendingLockupRewards = 3304n;
            const firstDelegatorLockupInfo = await that.sfc.getLockupInfo(that.firstDelegator.address, that.firstValidatorID);
    
            await that.sfc.connect(that.firstDelegator).restakeRewards(that.firstValidatorID);
    
            const updatedLockupInfo = await that.sfc.getLockupInfo(that.firstDelegator.address, that.firstValidatorID);
            expect(updatedLockupInfo.lockedStake).to.equal(
                firstDelegatorLockupInfo.lockedStake + firstDelegatorPendingLockupRewards
            );
        });

        it('Should return stashed Rewards', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            await that.node.sealEpoch(0);
            await that.node.sealEpoch(60 * 60 * 24);
    
            expect((await that.sfc.rewardsStash(that.firstDelegator.address, 1)).toString()).to.equal('0');
    
            await that.sfc.connect(that.firstDelegator).stashRewards(that.firstDelegator.address, 1);
            expect((await that.sfc.rewardsStash(that.firstDelegator.address, 1)).toString()).to.equal('2754');
        });
    
        it('Should update the validator on node', async () => {
            await that.constants.updateOfflinePenaltyThresholdTime(10000);
            await that.constants.updateOfflinePenaltyThresholdBlocksNum(500);
    
            expect(await that.constants.offlinePenaltyThresholdTime()).to.equal(10000);
            expect(await that.constants.offlinePenaltyThresholdBlocksNum()).to.equal(500);
        });
    
        it('Should not be able to deactivate validator if not Node', async () => {
            await that.sfc.disableNonNodeCalls();
            await expect(that.sfc.connect(that.user).deactivateValidator(1, 0)).to.be.rejectedWith(
                'caller is not the NodeDriverAuth contract'
            );
        });
    
        it('Should seal Epochs', async () => {
            let validatorsMetrics: Map<number, ValidatorMetrics> | undefined;
            const validatorIDs = await that.sfc.lastValidatorID();
    
            if (validatorsMetrics === undefined) {
                validatorsMetrics = new Map<number, ValidatorMetrics>()
                for (let i = 0; i < validatorIDs; i++) {
                    let m = new ValidatorMetrics(0, 0, 24 * 60 * 60, ethers.parseEther('100'));
                    validatorsMetrics.set(i, m)
                }
            }
    
            const allValidators = [];
            const offlineTimes: BigNumberish[] = [];
            const offlineBlocks: BigNumberish[] = [];
            const uptimes: BigNumberish[] = [];
            const originatedTxsFees: BigNumberish[] = [];
            for (let i = 0; i < validatorIDs; i++) {     
                const metrics =  validatorsMetrics.get(i) 
                if (metrics) {
                    allValidators.push(i + 1);
                    offlineTimes.push(metrics.offlineTime);
                    offlineBlocks.push(metrics.offlineBlocks);
                    uptimes.push(metrics.uptime);
                    originatedTxsFees.push(metrics.originatedTxsFee);
                }
            }
    
            await expect(that.sfc.advanceTime(24 * 60 * 60)).to.be.fulfilled;
            await expect(that.sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFees, 0)).to.be.fulfilled;
            await expect(that.sfc.sealEpochValidators(allValidators)).to.be.fulfilled;
        });
    
        it('Should seal Epoch on Validators', async () => {
            let validatorsMetrics: Map<number, ValidatorMetrics> | undefined;
            const validatorIDs = await that.sfc.lastValidatorID();
    
            if (validatorsMetrics === undefined) {
                validatorsMetrics = new Map<number, ValidatorMetrics>()
                for (let i = 0; i < validatorIDs; i++) {
                    let m = new ValidatorMetrics(0, 0, 24 * 60 * 60, ethers.parseEther('0'));
                    validatorsMetrics.set(i, m)
                }
            }
    
            const allValidators = [];
            const offlineTimes: BigNumberish[] = [];
            const offlineBlocks: BigNumberish[] = [];
            const uptimes: BigNumberish[] = [];
            const originatedTxsFees: BigNumberish[] = [];
            for (let i = 0; i < validatorIDs; i++) {     
                const metrics =  validatorsMetrics.get(i) 
                if (metrics) {
                    allValidators.push(i + 1);
                    offlineTimes.push(metrics.offlineTime);
                    offlineBlocks.push(metrics.offlineBlocks);
                    uptimes.push(metrics.uptime);
                    originatedTxsFees.push(metrics.originatedTxsFee);
                }
            }
    
            await expect(that.sfc.advanceTime(24 * 60 * 60)).to.be.fulfilled;
            await expect(that.sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFees, 0)).to.be.fulfilled;
            await expect(that.sfc.sealEpochValidators(allValidators)).to.be.fulfilled;
        });
    });

    describe('Stake lockup', () => {
        beforeEach('lock stakes', async () => {
            // Lock 75% of stake for 60% of a maximum lockup period
            await that.sfc.connect(that.firstValidator).lockStake(
                that.firstValidatorID,
                86400 * 219,
                ethers.parseEther('0.6')
            );
    
            // Lock 25% of stake for 20% of a maximum lockup period
            await that.sfc.connect(that.firstDelegator).lockStake(
                that.firstValidatorID,
                86400 * 73,
                ethers.parseEther('0.1')
            );
        });
    
        it('Check pending Rewards of delegators', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('0');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('0');
    
            await that.node.sealEpoch(60 * 60 * 24);
    
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('14279');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('3074');
        });
    
        it('Check if pending Rewards have been increased after sealing Epoch', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            await that.node.sealEpoch(60 * 60 * 24);
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('14279');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('3074');
    
            await that.node.sealEpoch(60 * 60 * 24);
            expect((await that.sfc.pendingRewards(that.firstValidator.address, that.firstValidatorID)).toString()).to.equal('28558');
            expect((await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('6150');
        });
    
        it('Should increase balances after claiming Rewards', async () => {
            await that.constants.updateBaseRewardPerSecond(100_000_000_000_000);
    
            await that.node.sealEpoch(0);
            await that.node.sealEpoch(60 * 60 * 24);
    
            const firstDelegatorPendingRewards = await that.sfc.pendingRewards(that.firstDelegator.address, that.firstValidatorID);
            const firstDelegatorBalance = await ethers.provider.getBalance(that.firstDelegator.address);
    
           await that.sfc.connect(that.firstDelegator).claimRewards(that.firstValidatorID);
    
            const newDelegatorBalance = await ethers.provider.getBalance(that.firstDelegator.address);
            expect(firstDelegatorBalance + firstDelegatorPendingRewards).to.above(newDelegatorBalance);
        });
    
        it('Should return stashed Rewards', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
    
            await that.node.sealEpoch(0);
            await that.node.sealEpoch(60 * 60 * 24);
    
            expect((await that.sfc.rewardsStash(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('0');
    
            await that.sfc.connect(that.firstDelegator).stashRewards(that.firstDelegator.address,that.firstValidatorID);
            expect((await that.sfc.rewardsStash(that.firstDelegator.address, that.firstValidatorID)).toString()).to.equal('3074');
        });
    
        it('Should return pending rewards after unlocking and re-locking', async () => {
            await that.constants.updateBaseRewardPerSecond(1);
        
            for (let i = 0; i < 2; i++) {
                const epoch = await that.sfc.currentSealedEpoch();
        
                // delegator 1 is still locked
                // delegator 1 should receive more rewards than delegator 2
                // validator 1 should receive more rewards than validator 2
                await that.node.sealEpoch(86400 * 73);
        
                // Check pending rewards
                expect(await that.node.sfc.pendingRewards(that.firstDelegator.address, 1)).to.eq(224496n);
                expect(await that.node.sfc.pendingRewards(that.secondDelegator.address, 2)).to.eq(201042n);
                expect(await that.node.sfc.pendingRewards(that.firstValidator.address, 1)).to.eq(1042461n);
                expect(await that.node.sfc.pendingRewards(that.secondValidator.address, 2)).to.eq(508518n);
        
                // Check highest lockup epoch
                expect(await that.node.sfc.highestLockupEpoch(that.firstDelegator.address, 1)).to.eq(epoch + 1n);
                expect(await that.node.sfc.highestLockupEpoch(that.secondDelegator.address, 2)).to.eq(0n);
                expect(await that.node.sfc.highestLockupEpoch(that.firstValidator.address, 1)).to.eq(epoch + 1n);
                expect(await that.node.sfc.highestLockupEpoch(that.secondValidator.address, 2)).to.eq(0);
        
                // delegator 1 isn't locked already
                // delegator 1 should receive the same reward as delegator 2
                // validator 1 should receive more rewards than validator 2
                await that.node.sealEpoch(86400 * 1);
        
                expect(await that.node.sfc.pendingRewards(that.firstDelegator.address, 1)).to.eq(224496 + 2754);
                expect(await that.node.sfc.pendingRewards(that.secondDelegator.address, 2)).to.eq(201042 + 2754);
                expect(await that.node.sfc.pendingRewards(that.firstValidator.address, 1)).to.eq(1042461 + 14279);
                expect(await that.node.sfc.pendingRewards(that.secondValidator.address, 2)).to.eq(508518 + 6966);
                expect(await that.node.sfc.highestLockupEpoch(that.firstDelegator.address, 1)).to.eq(epoch + 1n);
                expect(await that.node.sfc.highestLockupEpoch(that.firstValidator.address, 1)).to.eq(epoch  +2n);
                
                // validator 1 is still locked
                // delegator 1 should receive the same reward as delegator 2
                // validator 1 should receive more rewards than validator 2
                await that.node.sealEpoch(86400 * 145);

                // validator 1 isn't locked already
                // delegator 1 should receive the same reward as delegator 2
                // validator 1 should receive the same reward as validator 2
                await that.node.sealEpoch(86400 * 1);

                // Re-lock stakes
                await that.sfc.connect(that.firstValidator).lockStake(
                    that.firstValidatorID,
                    86400 * 219,
                    ethers.parseEther('0.6')
                );
        
                await that.sfc.connect(that.firstDelegator).lockStake(
                    that.firstValidatorID,
                    86400 * 73,
                    ethers.parseEther('0.1')
                );
        
                // Ensure rewards remain unchanged after re-locking
                expect(await that.sfc.pendingRewards(that.firstDelegator.address, 1)).to.eq(224496 + 2754 + 399330 + 2754);
                expect(await that.sfc.pendingRewards(that.secondDelegator.address, 2)).to.eq(201042 + 2754 + 399330 + 2754);
                expect(await that.sfc.pendingRewards(that.firstValidator.address, 1)).to.eq(1042461 + 14279 + 2070643 + 6966);
                expect(await that.sfc.pendingRewards(that.secondValidator.address, 2)).to.eq(508518 + 6966 + 1010070 + 6966);
        
                // Claim rewards to reset pending rewards
                await that.sfc.connect(that.firstDelegator).claimRewards(1);
                await that.sfc.connect(that.secondDelegator).claimRewards(2);
                await that.sfc.connect(that.firstValidator).claimRewards(1);
                await that.sfc.connect(that.secondValidator).claimRewards(2);
            }
        });
        
    });

    describe('NodeDriver', () => {
        it('Should not be able to call `setGenesisValidator` if not NodeDriver', async () => {
            await expect(
                that.nodeDriverAuth.connect(that.user).setGenesisValidator(
                    that.owner,
                    1,
                    pubkey,
                    1 << 3,
                    await that.sfc.currentEpoch(),
                    Date.now(),
                    0,
                    0
                )
            ).to.be.revertedWith('caller is not the NodeDriver contract');
        });
    
        it('Should not be able to call `setGenesisDelegation` if not NodeDriver', async () => {
            await expect(
                that.nodeDriverAuth.connect(that.user).setGenesisDelegation(
                    that.firstDelegator.address,
                    1,
                    100,
                    0,
                    0,
                    0,
                    0,
                    0,
                    1000
                )
            ).to.be.revertedWith('caller is not the NodeDriver contract');
        });
    
        it('Should not be able to call `deactivateValidator` if not NodeDriver', async () => {
            await expect(
                that.nodeDriverAuth.connect(that.user).deactivateValidator(1, 0)
            ).to.be.revertedWith('caller is not the NodeDriver contract');
        });
    
        it('Should not be able to call `deactivateValidator` with wrong status', async () => {
            await expect(
                that.sfc.deactivateValidator(1, 0)
            ).to.be.revertedWith('wrong status');
        });
    
        it('Should deactivate Validator', async () => {
            await expect(
                that.sfc.deactivateValidator(1, 1)
            ).to.not.be.reverted;
        });
    
        it('Should not be able to call `sealEpochValidators` if not NodeDriver', async () => {
            await expect(
                that.nodeDriverAuth.connect(that.user).sealEpochValidators([1])
            ).to.be.revertedWith('caller is not the NodeDriver contract');
        });
    
        it('Should not be able to call `sealEpoch` if not NodeDriver', async () => {
            const validatorIDs = await that.sfc.lastValidatorID()

            const offlineTimes: BigNumberish[] = Array(validatorIDs).fill(0n);
            const offlineBlocks = Array(validatorIDs).fill(0n);
            const uptimes = Array(validatorIDs).fill(BigInt(24 * 60 * 60));
            const originatedTxsFees = Array(validatorIDs).fill(ethers.parseEther('0'));
    
            await expect(that.sfc.advanceTime(24 * 60 * 60)).to.not.be.reverted;
    
            await expect(
                that.nodeDriverAuth.connect(that.user).sealEpoch(
                    offlineTimes,
                    offlineBlocks,
                    uptimes,
                    originatedTxsFees,
                    0
                )
            ).to.be.revertedWith('caller is not the NodeDriver contract');
        });
    });
    

    describe('Epoch getters', () => {
        let currentSealedEpoch: bigint;
    
        beforeEach(async () => {
            currentSealedEpoch = await that.sfc.currentSealedEpoch();
        });
    
        it('should return Epoch validator IDs', async () => {
            const validatorIDs = await that.sfc.getEpochValidatorIDs(currentSealedEpoch);
            console.log('Validator IDs:', validatorIDs);
            expect(validatorIDs).to.be.an('array'); // Adjust based on return type
        });
    
        it('should return the Epoch Received Stake', async () => {
            const receivedStake = await that.sfc.getEpochReceivedStake(currentSealedEpoch, 1);
            console.log('Received Stake:', receivedStake.toString());
            expect(receivedStake).to.be.a('bigint');
        });
    
        it('should return the Epoch Accumulated Reward Per Token', async () => {
            const accumulatedRewardPerToken = await that.sfc.getEpochAccumulatedRewardPerToken(currentSealedEpoch, 1);
            console.log('Accumulated Reward Per Token:', accumulatedRewardPerToken.toString());
            expect(accumulatedRewardPerToken).to.be.a('bigint');
        });
    
        it('should return the Epoch Accumulated Uptime', async () => {
            const accumulatedUptime = await that.sfc.getEpochAccumulatedUptime(currentSealedEpoch, 1);
            console.log('Accumulated Uptime:', accumulatedUptime.toString());
            expect(accumulatedUptime).to.be.a('bigint');
        });
    
        it('should return the Epoch Accumulated Originated Txs Fee', async () => {
            const accumulatedTxsFee = await that.sfc.getEpochAccumulatedOriginatedTxsFee(currentSealedEpoch, 1);
            console.log('Accumulated Originated Txs Fee:', accumulatedTxsFee.toString());
            expect(accumulatedTxsFee).to.be.a('bigint');
        });
    
        it('should return the Epoch Offline Time', async () => {
            const offlineTime = await that.sfc.getEpochOfflineTime(currentSealedEpoch, 1);
            console.log('Offline Time:', offlineTime.toString());
            expect(offlineTime).to.be.a('bigint');
        });
    
        it('should return Epoch Offline Blocks', async () => {
            const offlineBlocks = await that.sfc.getEpochOfflineBlocks(currentSealedEpoch, 1);
            console.log('Offline Blocks:', offlineBlocks.toString());
            expect(offlineBlocks).to.be.a('bigint');
        });
    });
    
    describe('Unlock features', () => {
        it('should fail if trying to unlock stake when not locked', async () => {
            await expect(
                that.sfc.unlockStake(1, 10)
            ).to.be.rejectedWith('not locked up');
        });
    
        it('should fail if trying to unlock stake with amount 0', async () => {
            await expect(
                that.sfc.unlockStake(1, 0)
            ).to.be.rejectedWith('zero amount');
        });
    
        it('should return whether the validator is slashed', async () => {
            const isSlashed = await that.sfc.isSlashed(1);
            console.log('Is Validator Slashed:', isSlashed);
            expect(isSlashed).to.be.a('boolean');
        });
    
        it('should fail if delegating to a non-existing validator', async () => {
            await expect(
                that.sfc.delegate(4)
            ).to.be.rejectedWith("validator doesn't exist");
        });
    
        it('should fail if delegating to a non-existing validator with value', async () => {
            await expect(
                that.sfc.delegate(4, { value: ethers.parseEther('0.01') })
            ).to.be.rejectedWith("validator doesn't exist");
        });
    });
    
    describe('SFC Rewards getters / Features', () => {
        it('should return stashed rewards', async () => {
            const rewardsStash = await that.sfc.rewardsStash(that.firstDelegator, 1);
            console.log('Rewards Stash:', rewardsStash.toString());
            expect(rewardsStash).to.be.a('bigint');
        });
    
        it('should return locked stake for Validator 1', async () => {
            const lockedStake = await that.sfc.getLockedStake(that.firstDelegator, 1);
            console.log('Locked Stake for Validator 1:', lockedStake.toString());
            expect(lockedStake).to.be.a('bigint');
        });
    
        it('should return locked stake for Validator 2', async () => {
            const lockedStake = await that.sfc.getLockedStake(that.firstDelegator, 2);
            console.log('Locked Stake for Validator 2:', lockedStake.toString());
            expect(lockedStake).to.be.a('bigint');
        });
    });
    
})

describe('Staking / Sealed Epoch functions', () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        firstValidatorID: bigint,
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
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
        await sfc.enableNonNodeCalls();

        await sfc.setGenesisValidator(firstValidator, 1, pubkey, 0, await sfc.currentEpoch(), Date.now(), 0, 0);
        const firstValidatorID = await sfc.getValidatorID(firstValidator);
        await sfc.delegate(firstValidatorID, {
            from: firstValidator,
            value: ethers.parseEther("4"),
        });

        const node = new BlockchainNode(sfc);

        await node.sealEpoch(24 * 60 * 60);

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
            thirdDelegator,
            firstValidatorID,
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Should set Genesis Delegation for a Validator', async () => {
        // Set Genesis Delegation
        await expect(
            that.sfc.setGenesisDelegation(
                that.firstDelegator, // Delegator address
                that.firstValidatorID, // Validator ID
                ethers.parseEther("1"), // Stake amount
                0, 0, 0, 0, 0, // Lockup details (unused here)
                100 // Rewards
            )
        ).to.be.fulfilled;

        // Validate the stake amount for the delegator
        const stake = await that.sfc.getStake(that.firstDelegator, that.firstValidatorID);
        expect(stake).to.equal(ethers.parseEther("1"));
    });
   
});

describe('Test Rewards Calculation', () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        testValidator1ID: bigint,
        testValidator2ID: bigint,
        testValidator3ID: bigint
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
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
        await sfc.enableNonNodeCalls();

        await constants.updateBaseRewardPerSecond(ethers.parseEther("1"));

        const node = new BlockchainNode(sfc);


        await node.handleTx(await sfc.connect(firstValidator).createValidator(pubkey, {
            value: ethers.parseEther("10"),
        }));

        await node.handleTx(await sfc.connect(secondValidator).createValidator(pubkey, {
            value:ethers.parseEther("5"),
        }));

        await node.handleTx(await sfc.connect(thirdValidator).createValidator(pubkey, {
            value: ethers.parseEther("1"),
        }));

        const testValidator1ID = await sfc.getValidatorID(firstValidator);
        const testValidator2ID = await sfc.getValidatorID(secondValidator);
        const testValidator3ID = await sfc.getValidatorID(thirdValidator);

        await sfc.connect(thirdValidator).lockStake(testValidator3ID, 60 * 60 * 24 * 364, ethers.parseEther("1"));
        await node.sealEpoch(0);

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
            thirdDelegator,
            testValidator1ID,
            testValidator2ID,
            testValidator3ID
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Calculation of validators rewards should be equal to 30%', async () => {
        await that.node.sealEpoch(1000);

        const rewardAcc1 = await that.sfc.pendingRewards(that.firstValidator, that.testValidator1ID);
        const rewardAcc2 = await that.sfc.pendingRewards(that.secondValidator, that.testValidator2ID);
        const rewardAcc3 = await that.sfc.pendingRewards(that.thirdValidator, that.testValidator3ID);
        const totalRewards = rewardAcc1 + rewardAcc2 + rewardAcc3;
        expect(totalRewards).to.equal(343630136986301369811n);
    });
    
    it('Should not be able withdraw if request does not exist', async () => {
        await expect(that.sfc.withdraw(that.testValidator1ID, 0)).to.be.rejectedWith("request doesn't exist")
    });

    it('Should not be able to undelegate 0 amount', async () => {
        await that.node.sealEpoch(1000);
        await expect(that.sfc.undelegate(that.testValidator1ID, 0, 0)).to.be.rejectedWith("zero amount")
    });

    it('Should not be able to undelegate if not enough unlocked stake', async () => {
        await that.node.sealEpoch(1000);
        await expect(that.sfc.undelegate(that.testValidator2ID, 0, 10)).to.be.rejectedWith("not enough unlocked stake");
    });
    
    it('Should not be able to unlock if not enough unlocked stake', async () => {
        await that.node.sealEpoch(1000);
        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator1ID, {value:ethers.parseEther("1") });
    
       await expect(that.sfc.connect( that.thirdDelegator).unlockStake(that.testValidator1ID, 10), 'not locked up');
    });
    
    it('should return the unlocked stake', async () => {
        await that.node.sealEpoch(1000);
        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {value: ethers.parseEther("1") });
    
        const unlockedStake = await that.sfc.getUnlockedStake(that.thirdDelegator, that.testValidator3ID);
        expect(unlockedStake.toString()).to.equal(ethers.parseEther("1"));
    });

    it('should return the unlocked stake', async () => {
        await that.node.sealEpoch(1000);
        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, { value: ethers.parseEther('1') });
    
        const unlockedStake = await that.sfc.getUnlockedStake(that.thirdDelegator, that.testValidator3ID);
        expect(unlockedStake.toString()).to.equal(ethers.parseEther("1"));
    });
    
    it('Should not be able to claim Rewards if 0 rewards', async () => {
        await that.node.sealEpoch(1000);
        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {value:ethers.parseEther("10") });
    
        await that.node.sealEpoch(100);
        await expect(that.sfc.connect(that.thirdDelegator).claimRewards(that.testValidator1ID), 'zero rewards');
    });
    
    
})


describe('Test Calculation Rewards with Lockup', () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        testValidator1ID: bigint,
        testValidator2ID: bigint,
        testValidator3ID: bigint
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
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
        await sfc.enableNonNodeCalls();

        await constants.updateBaseRewardPerSecond(ethers.parseEther("1"));

        const node = new BlockchainNode(sfc);


        await node.handleTx(await sfc.connect(firstValidator).createValidator(pubkey, {
            value: ethers.parseEther("10"),
        }));

        await node.handleTx(await sfc.connect(secondValidator).createValidator(pubkey, {
            value:ethers.parseEther("5"),
        }));

        await node.handleTx(await sfc.connect(thirdValidator).createValidator(pubkey, {
            value: ethers.parseEther("1"),
        }));

        const testValidator1ID = await sfc.getValidatorID(firstValidator);
        const testValidator2ID = await sfc.getValidatorID(secondValidator);
        const testValidator3ID = await sfc.getValidatorID(thirdValidator);

        await sfc.connect(thirdValidator).lockStake(testValidator3ID, 60 * 60 * 24 * 364, ethers.parseEther("1"));
        await node.sealEpoch(0);

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
            thirdDelegator,
            testValidator1ID,
            testValidator2ID,
            testValidator3ID
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Should not be able to lock 0 amount', async () => {
        await that.node.sealEpoch(1000);

        await expect(
            that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator1ID, 2 * 60 * 60 * 24 * 365, ethers.parseEther('0'))
        ).to.be.rejectedWith('zero amount');
    });

    it('Should not be able to lock more than a year', async () => {
        await that.node.sealEpoch(1000);


        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await expect(
            that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 2 * 60 * 60 * 24 * 365, ethers.parseEther('1'))
        ).to.be.rejectedWith('incorrect duration');
    });

    it('Should not be able to lock more than validator lockup period', async () => {
        await that.node.sealEpoch(1000);


        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await expect(
            that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 365, ethers.parseEther('1'))
        ).to.be.rejectedWith('validator lockup period will end earlier');
    });

    it('Should be able to lock for 1 month', async () => {
        await that.node.sealEpoch(1000);

        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 14, ethers.parseEther('1'));

        await that.node.sealEpoch(60 * 60 * 24 * 14);
    });

    it('Should not unlock if not locked up U2U', async () => {
        await that.node.sealEpoch(1000);

        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 14, ethers.parseEther('1'));

        await that.node.sealEpoch(60 * 60 * 24 * 14);

        await expect(
            that.sfc.connect(that.thirdDelegator).unlockStake(that.testValidator2ID, ethers.parseEther('10'))
        ).to.be.rejectedWith('not locked up');
    });

    it('Should not be able to unlock more than locked stake', async () => {
        await that.node.sealEpoch(1000);

        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 14, ethers.parseEther('1'));

        await that.node.sealEpoch(60 * 60 * 24 * 14);

        await expect(
            that.sfc.connect(that.thirdDelegator).unlockStake(that.testValidator3ID, ethers.parseEther('10'))
        ).to.be.rejectedWith('not enough locked stake');
    });

    it('Should scale unlocking penalty', async () => {
        await that.node.sealEpoch(1000);

        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });

        await that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 14, ethers.parseEther('1'));

        await that.node.sealEpoch(100);

        expect(
            await that.sfc.connect(that.thirdDelegator).unlockStake.staticCall(that.testValidator3ID, ethers.parseEther('1'))
        ).to.be.eq(ethers.parseEther('0.085410180572851805'));

        expect(
            await that.sfc.connect(that.thirdDelegator).unlockStake.staticCall(that.testValidator3ID, ethers.parseEther('0.5'))
        ).to.equal(ethers.parseEther('0.042705090286425902'));

        await that.sfc.connect(that.thirdDelegator).unlockStake.staticCall(that.testValidator3ID, ethers.parseEther('0.5'));

        await expect(
            that.sfc.connect(that.thirdDelegator).unlockStake(that.testValidator3ID, ethers.parseEther('1.51'))
        ).to.be.rejectedWith('not enough locked stake');
    });

    it('Should unlock after period ended and stash rewards', async () => {
        await that.node.sealEpoch(1000);
    
        await that.sfc.connect(that.thirdDelegator).delegate(that.testValidator3ID, {
            value: ethers.parseEther('10'),
        });
    
        let unlockedStake = await that.sfc.connect(that.thirdDelegator).getUnlockedStake(that.thirdDelegator.address, that.testValidator3ID);
        let pendingRewards = await that.sfc.connect(that.thirdDelegator).pendingRewards(that.thirdDelegator.address, that.testValidator3ID);
    
        expect(unlockedStake).to.be.eq('10000000000000000000');
        expect(pendingRewards).to.be.eq('0');
    
        await that.sfc.connect(that.thirdDelegator).lockStake(that.testValidator3ID, 60 * 60 * 24 * 14, ethers.parseEther('1'));
    
        unlockedStake = await that.sfc.connect(that.thirdDelegator).getUnlockedStake(that.thirdDelegator.address, that.testValidator3ID);
        pendingRewards = await that.sfc.connect(that.thirdDelegator).pendingRewards(that.thirdDelegator.address, that.testValidator3ID);
    
        expect(unlockedStake).to.be.eq('9000000000000000000');
        expect(pendingRewards).to.be.eq('0');
    
        await that.node.sealEpoch(60 * 60 * 24 * 14);
    
        unlockedStake = await that.sfc.connect(that.thirdDelegator).getUnlockedStake(that.thirdDelegator.address, that.testValidator3ID);
        pendingRewards = await that.sfc.connect(that.thirdDelegator).pendingRewards(that.thirdDelegator.address, that.testValidator3ID);
    
        expect(unlockedStake).to.equal('9000000000000000000');
        expect(pendingRewards).to.equal(17682303362391033619905n);
    
        await that.node.sealEpoch(60 * 60 * 24 * 14);
    
        pendingRewards = await that.sfc.connect(that.thirdDelegator).pendingRewards(that.thirdDelegator.address, that.testValidator3ID);
        unlockedStake = await that.sfc.connect(that.thirdDelegator).getUnlockedStake(that.thirdDelegator.address, that.testValidator3ID);
    
        expect(unlockedStake).to.equal('10000000000000000000');
        expect(ethers.formatEther(pendingRewards)).to.equal('136316.149516237187466057');
    
        await that.sfc.connect(that.thirdDelegator).stashRewards(that.thirdDelegator.address, that.testValidator3ID);
    });
    
})

describe('Test Rewards with lockup Calculation', () => {
    let that: That & {
        firstValidator: HardhatEthersSigner,
        secondValidator: HardhatEthersSigner,
        thirdValidator: HardhatEthersSigner,
        firstDelegator: HardhatEthersSigner,
        secondDelegator: HardhatEthersSigner,
        thirdDelegator: HardhatEthersSigner,
        node: BlockchainNode,
        testValidator1ID: bigint,
        testValidator2ID: bigint,
        testValidator3ID: bigint
    }
    const fixture = async () => {
        const [firstValidator, secondValidator, thirdValidator, firstDelegator, secondDelegator, thirdDelegator] = await ethers.getSigners();
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
        await sfc.enableNonNodeCalls();

        await constants.updateBaseRewardPerSecond(ethers.parseEther("1"));

        const node = new BlockchainNode(sfc);


        await node.handleTx(await sfc.connect(firstValidator).createValidator(pubkey, {
            value: ethers.parseEther("10"),
        }));

        await node.handleTx(await sfc.connect(secondValidator).createValidator(pubkey, {
            value:ethers.parseEther("5"),
        }));

        await node.handleTx(await sfc.connect(thirdValidator).createValidator(pubkey, {
            value: ethers.parseEther("1"),
        }));

        const testValidator1ID = await sfc.getValidatorID(firstValidator);
        const testValidator2ID = await sfc.getValidatorID(secondValidator);
        const testValidator3ID = await sfc.getValidatorID(thirdValidator);

        await sfc.connect(thirdValidator).lockStake(testValidator3ID, 60 * 60 * 24 * 364, ethers.parseEther("1"));
        await node.sealEpoch(0);

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
            thirdDelegator,
            testValidator1ID,
            testValidator2ID,
            testValidator3ID
        };
    }

    beforeEach(async function () {
        that = await loadFixture(fixture);
    })

    it('Should not update slashing refund ratio', async () => {
        await that.node.sealEpoch(1000);
    
        await expect(that.sfc.connect(that.firstValidator)
            .updateSlashingRefundRatio(that.testValidator3ID, 1))
            .to.be.rejectedWith("validator isn't slashed");
    
        await that.node.sealEpoch(60 * 60 * 24 * 14);
    });
    
    it('Should not sync if validator does not exist', async () => {
        await expect(that.sfc._syncValidator(33, false))
            .to.be.rejectedWith("validator doesn't exist");
    });
    
})