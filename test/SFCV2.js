/* eslint-disable radix */
/* eslint-disable no-await-in-loop */
/* eslint-disable guard-for-in */
/* eslint-disable no-plusplus */
const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const chai = require('chai');
const { expect } = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const UnitTestSFC = artifacts.require('UnitTestSFC');
const UnitTestSFCLib = artifacts.require('UnitTestSFCLib');
const SFCI = artifacts.require('SFCUnitTestI');
const SFCIV2 = artifacts.require('SFCUnitTestIV2');

const NodeDriverAuth = artifacts.require('NodeDriverAuth');
const NodeDriver = artifacts.require('NodeDriver');
const NetworkInitializer = artifacts.require('UnitTestNetworkInitializer');
const StubEvmWriter = artifacts.require('StubEvmWriter');
const ConstantsManager = artifacts.require('UnitTestConstantsManager');

function amount18(n) {
    return new BN(web3.utils.toWei(n, 'ether'));
}

async function sealEpoch(sfc, duration, _validatorsMetrics = undefined) {
    let validatorsMetrics = _validatorsMetrics;
    const validatorIDs = (await sfc.lastValidatorID()).toNumber();

    if (validatorsMetrics === undefined) {
        validatorsMetrics = {};
        for (let i = 0; i < validatorIDs; i++) {
            validatorsMetrics[i] = {
                offlineTime: new BN('0'),
                offlineBlocks: new BN('0'),
                uptime: duration,
                originatedTxsFee: amount18('0'),
            };
        }
    }
    // unpack validator metrics
    const allValidators = [];
    const offlineTimes = [];
    const offlineBlocks = [];
    const uptimes = [];
    const originatedTxsFees = [];
    for (let i = 0; i < validatorIDs; i++) {
        allValidators.push(i + 1);
        offlineTimes.push(validatorsMetrics[i].offlineTime);
        offlineBlocks.push(validatorsMetrics[i].offlineBlocks);
        uptimes.push(validatorsMetrics[i].uptime);
        originatedTxsFees.push(validatorsMetrics[i].originatedTxsFee);
    }

    await sfc.advanceTime(duration);
    await sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFees, 0);
    await sfc.sealEpochValidators(allValidators);
}

const pubkey = '0x00a2941866e485442aa6b17d67d77f8a6c4580bb556894cc1618473eff1e18203d8cce50b563cf4c75e408886079b8f067069442ed52e2ac9e556baa3f8fcc525f';

contract('SFC', async ([firstValidator,,,, thirdDelegator, account1, account2, account3]) => {
    let testValidator1ID;
    let testValidator3ID;

    beforeEach(async () => {
        const sfc = await UnitTestSFC.new();

        this.sfcv1 = await SFCI.at(sfc.address);
        this.sfc = await SFCIV2.at(sfc.address);
        const nodeIRaw = await NodeDriver.new();
        const evmWriter = await StubEvmWriter.new();
        this.nodeI = await NodeDriverAuth.new();
        this.sfcLib = await UnitTestSFCLib.new();
        const initializer = await NetworkInitializer.new();
        await initializer.initializeAll(0, 0, this.sfc.address, this.sfcLib.address, this.nodeI.address, nodeIRaw.address, evmWriter.address, firstValidator);
        this.consts = await ConstantsManager.at(await this.sfc.constsAddress.call());
        await this.sfc.rebaseTime();
        await this.sfc.enableNonNodeCalls();

        await this.consts.updateBaseRewardPerSecond(amount18('1'));

        await this.sfc.createValidator(pubkey, {
            from: account1,
            value: amount18('10'),
        });

        await this.sfc.createValidator(pubkey, {
            from: account2,
            value: amount18('5'),
        });

        await this.sfc.createValidator(pubkey, {
            from: account3,
            value: amount18('1'),
        });

        await sealEpoch(this.sfc, (new BN(0)).toString());

        testValidator1ID = await this.sfc.getValidatorID(account1);
        testValidator3ID = await this.sfc.getValidatorID(account3);

        await this.sfc.lockStake(testValidator3ID, (60 * 60 * 24 * 364), amount18('1'),
            { from: account3 });

        await sealEpoch(this.sfc, (new BN(0)).toString());
    });

    describe('relock validator when lock stake', () => {
        it('should not be able to relock', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());
            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await expectRevert(this.sfc.lockStake(testValidator3ID, (60 * 60 * 24 * 365), amount18('1'), { from: thirdDelegator }), 'validator lockup period will end earlier');
        });

        it('should be able to relock', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());
            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });
            await this.sfc.setEnabledAutoRelock(testValidator3ID, true, { from: account3 });
            this.sfc.lockStake(testValidator3ID, (60 * 60 * 24 * 365), amount18('1'), { from: thirdDelegator });
        });
    });

    describe('lock stake v2', () => {
        it('Should not be able to lock 0 amount', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await expectRevert(this.sfc.createLockStake(testValidator1ID, (2 * 60 * 60 * 24 * 365), amount18('0'), {
                from: thirdDelegator,
            }), 'zero amount');
        });

        it('Should not be able to lock more than a year', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await expectRevert(this.sfc.createLockStake(testValidator3ID, (2 * 60 * 60 * 24 * 365), amount18('1'), {
                from: thirdDelegator,
            }), 'incorrect duration');
        });

        it('Should not be able to lock more than validator lockup period', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await expectRevert(this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 365), amount18('1'),
                { from: thirdDelegator }), 'validator lockup period will end earlier');
        });

        it('Should be able to lock for 1 month', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(60 * 60 * 24 * 14)).toString());
        });

        it('Should not unlock if not locked up U2U', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(60 * 60 * 24 * 14)).toString());

            await expectRevert(this.sfc.unlockStake(testValidator3ID, 1, amount18('10')), 'not locked up');
        });

        it('Should not be able to unlock more than locked stake', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(60 * 60 * 24 * 14)).toString());

            await expectRevert(this.sfc.unlockStake(testValidator3ID, 1, amount18('10'), { from: thirdDelegator }), 'not enough locked stake');
        });

        it('Should scale unlocking penalty', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(100)).toString());

            expect(await this.sfc.unlockStake.call(testValidator3ID, 1, amount18('1'), { from: thirdDelegator })).to.be.bignumber.equal(amount18('0.085410180572851805'));
            expect(await this.sfc.unlockStake.call(testValidator3ID, 1, amount18('0.5'), { from: thirdDelegator })).to.be.bignumber.equal(amount18('0.042705090286425902'));
            expect(await this.sfc.unlockStake.call(testValidator3ID, 1, amount18('0.01'), { from: thirdDelegator })).to.be.bignumber.equal(amount18('0.000854101805728517'));
            await this.sfc.unlockStake(testValidator3ID, 1, amount18('0.5'), { from: thirdDelegator });
            await expectRevert(this.sfc.unlockStake(testValidator3ID, 1, amount18('0.51'), { from: thirdDelegator }), 'not enough locked stake');
            expect(await this.sfc.unlockStake.call(testValidator3ID, 1, amount18('0.5'), { from: thirdDelegator })).to.be.bignumber.equal(amount18('0.042705090286425903'));
            expect(await this.sfc.unlockStake.call(testValidator3ID, 1, amount18('0.01'), { from: thirdDelegator })).to.be.bignumber.equal(amount18('0.000854101805728517'));
        });

        it('Should unlock after period ended and stash rewards', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            let unlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID, { from: thirdDelegator });
            let pendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1], { from: thirdDelegator });

            expect(unlockedStake.toString()).to.equal('10000000000000000000');
            expect(web3.utils.fromWei(pendingRewards.toString(), 'ether')).to.equal('0');
            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            unlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID, { from: thirdDelegator });
            pendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1], { from: thirdDelegator });

            expect(unlockedStake.toString()).to.equal('9000000000000000000');
            expect(web3.utils.fromWei(pendingRewards.toString(), 'ether')).to.equal('0');
            await sealEpoch(this.sfc, (new BN(60 * 60 * 24 * 14)).toString());

            unlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID, { from: thirdDelegator });
            pendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1], { from: thirdDelegator });
            let pendingRewardsv1 = await this.sfcv1.pendingRewards(thirdDelegator, testValidator3ID, { from: thirdDelegator });

            expect(unlockedStake.toString()).to.equal('9000000000000000000');
            expect(web3.utils.fromWei(pendingRewards.toString(), 'ether')).to.equal('1909.394271481942710817');
            expect(web3.utils.fromWei(pendingRewardsv1.toString(), 'ether')).to.equal('15772.909090909090909088');

            await this.sfc.unlockStake(testValidator3ID, 1, amount18('1'), { from: thirdDelegator });
            await sealEpoch(this.sfc, (new BN(60 * 60 * 24 * 14)).toString());
            pendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1], { from: thirdDelegator });
            pendingRewardsv1 = await this.sfcv1.pendingRewards(thirdDelegator, testValidator3ID, { from: thirdDelegator });

            expect(web3.utils.fromWei(pendingRewards.toString(), 'ether')).to.equal('0');
            expect(web3.utils.fromWei(pendingRewardsv1.toString(), 'ether')).to.equal('138068.694970782642011512');

            unlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID, { from: thirdDelegator });
            expect(unlockedStake.toString()).to.equal('10000000000000000000');

            await expectRevert(this.sfc.stashRewards(thirdDelegator, testValidator3ID, [1], { from: thirdDelegator }), 'nothing to stash');
        });
    });

    describe('relock stake', () => {
        it('should not be relock stake', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await expectRevert(this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 14, amount18('0'), { from: thirdDelegator }), 'zero amount');
            await expectRevert(this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 366, amount18('1'), { from: thirdDelegator }), 'incorrect duration');
            await expectRevert(this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 13, amount18('1'), { from: thirdDelegator }), 'incorrect duration');
            await expectRevert(this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 15, amount18('10000'), { from: thirdDelegator }), 'not enough stake');
            await expectRevert(this.sfc.relockStake(testValidator1ID, 2, 60 * 60 * 24 * 15, amount18('10000'), { from: thirdDelegator }), 'not enough stake');
            await expectRevert(this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 365, amount18('1'), { from: thirdDelegator }), 'validator lockup period will end earlier');
        });

        it('should be relock stake', async () => {
            await sealEpoch(this.sfc, (new BN(1000)).toString());

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            const prevLockupInfo = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);
            const prevUnlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID);
            await this.sfc.relockStake(testValidator3ID, 1, 60 * 60 * 24 * 14, amount18('1'), { from: thirdDelegator });
            const unlockedStake = await this.sfc.getUnlockedStake(thirdDelegator, testValidator3ID);
            const lockupInfo = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);
            expect(prevLockupInfo.lockedStake.add(amount18('1'))).to.bignumber.equal(lockupInfo.lockedStake);
            expect(prevUnlockedStake.sub(amount18('1'))).to.bignumber.equal(unlockedStake);
        });
    });

    describe('claim reward', () => {
        it('Should return claimed Rewards until Epoch', async () => {
            await this.consts.updateBaseRewardPerSecond(new BN('1'));

            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(60 * 60 * 24)).toString());
            await sealEpoch(this.sfc, (new BN(60 * 60 * 24)).toString());

            let ld = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);
            expect(ld.lockStashedRewardsUntilEpoch).to.bignumber.equal(new BN(2));

            const firstDelegatorPendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1]);
            const firstDelegatorBalance = new BN(await web3.eth.getBalance(thirdDelegator));

            await this.sfc.claimRewards(testValidator3ID, [1], { from: thirdDelegator });
            const pendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1]);
            const delegatorBalance = new BN(await web3.eth.getBalance(thirdDelegator));

            expect(firstDelegatorBalance.add(firstDelegatorPendingRewards)).to.be.bignumber.above(delegatorBalance);
            expect(firstDelegatorBalance.add(firstDelegatorPendingRewards)).to.be.bignumber.below(delegatorBalance.add(amount18('0.01')));

            ld = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);
            expect(ld.lockStashedRewardsUntilEpoch).to.bignumber.equal(await this.sfc.currentSealedEpoch());
            expect(pendingRewards).to.bignumber.equal(BN(0));
        });
    });

    describe('restake reward', () => {
        it('Should increase stake after restaking Rewards', async () => {
            await this.consts.updateBaseRewardPerSecond(new BN('1'));
            await this.sfc.delegate(testValidator3ID, {
                from: thirdDelegator,
                value: amount18('10'),
            });

            await this.sfc.createLockStake(testValidator3ID, (60 * 60 * 24 * 14), amount18('1'),
                { from: thirdDelegator });

            await sealEpoch(this.sfc, (new BN(0)).toString());
            await sealEpoch(this.sfc, (new BN(60 * 60 * 24)).toString());

            const firstDelegatorPendingRewards = await this.sfc.pendingRewards(thirdDelegator, testValidator3ID, [1]);
            expect(firstDelegatorPendingRewards).to.be.bignumber.equal(new BN('923'));
            const firstDelegatorStake = await this.sfc.getStake(thirdDelegator, testValidator3ID);
            const firstDelegatorLockupInfo = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);

            await this.sfc.restakeRewards(testValidator3ID, 1, { from: thirdDelegator });

            const delegatorStake = await this.sfc.getStake(thirdDelegator, testValidator3ID);
            const delegatorLockupInfo = await this.sfc.getLockupInfoV2(thirdDelegator, testValidator3ID, 1);
            expect(delegatorStake).to.be.bignumber.equal(firstDelegatorStake.add(firstDelegatorPendingRewards));
            expect(delegatorLockupInfo.lockedStake).to.be.bignumber.equal(firstDelegatorLockupInfo.lockedStake.add(firstDelegatorPendingRewards));
        });
    });
});
