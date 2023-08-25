pragma solidity ^0.5.0.0;

import "./SFCI.sol";
import "./NodeDriver.sol";
import "./SFCLib.sol";
import "./ConstantsManager.sol";

contract NetworkInitializer {
    // Initialize NodeDriverAuth, NodeDriver and SFC in one call to allow fewer genesis transactions
    function initializeAll(uint256 sealedEpoch, uint256 totalSupply, address payable _sfc, address _lib, address _auth, address _driver, address _evmWriter, address _owner) external {
        NodeDriver(_driver).initialize(_auth, _evmWriter);
        NodeDriverAuth(_auth).initialize(_sfc, _driver, _owner);

        ConstantsManager consts = new ConstantsManager();
        consts.initialize();
        consts.updateMinSelfStake(1000000 * 1e18);
        consts.updateMaxDelegatedRatio(10 * Decimal.unit());
        consts.updateValidatorCommission((15 * Decimal.unit()) / 100);
        consts.updateBurntFeeShare((5 * Decimal.unit()) / 100);
        consts.updateTreasuryFeeShare((20 * Decimal.unit()) / 100);
        consts.updateUnlockedRewardRatio((30 * Decimal.unit()) / 100);
        consts.updateMinLockupDuration(86400 * 14);
        consts.updateMaxLockupDuration(86400 * 365);
        consts.updateWithdrawalPeriodEpochs(3);
        consts.updateWithdrawalPeriodTime(60 * 60 * 24 * 7);
        consts.updateBaseRewardPerSecond(3802651753849535500);
        consts.updateOfflinePenaltyThresholdTime(5 days);
        consts.updateOfflinePenaltyThresholdBlocksNum(1000);
        consts.updateTargetGasPowerPerSecond(2000000);
        consts.updateGasPriceBalancingCounterweight(3600);
        consts.transferOwnership(_owner);

        SFCI(_sfc).initialize(sealedEpoch, totalSupply, _auth, _lib, address(consts), _owner);
        selfdestruct(address(0));
    }
}


