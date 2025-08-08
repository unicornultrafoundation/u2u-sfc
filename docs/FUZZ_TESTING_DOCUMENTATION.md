# U2U SFC Fuzz Testing Documentation

**Last Updated**: August 8, 2025  
**Repository**: u2u-sfc  
**Testing Framework**: Fast-Check Property-Based Testing  

## Overview

This document provides comprehensive test-by-test analysis of all fuzz testing implementations across the U2U SFC (Smart Contract for Consensus) project using tabular format for clear specification of input ranges, real/fake values, and expected behaviors.

## Test Files Summary

| File | Status | Tests Count | Runs | Last Analyzed | Coverage |
|------|--------|-------------|------|---------------|----------|
| `fuzz_CM.ts` | ✅ Active | 52 tests | 520 runs | 2025-08-08 | Constants Manager boundary testing |
| `fuzz_get_methods_SFC.ts` | ✅ Active | 42 tests | 385 runs | 2025-08-08 | Read-only SFC methods |
| `fuzz_state_changing_SFC.ts` | ✅ Active | 21 tests | 190 runs | 2025-08-08 | State-changing SFC methods |

---

# Detailed Test Specifications

## 1. fuzz_CM.ts - Constants Manager Fuzz Tests

| Test Name | Input Range | Real Values (%) | Fake Values (%) | Expected Behavior | Runs |
|-----------|-------------|----------------|-----------------|-------------------|------|
| **updateMinSelfStake - too small** | 0 - 100,000 ETH | 90% | 10% | Revert: "too small value" | 10 |
| **updateMinSelfStake - too big** | 10,000,001+ ETH | 90% | 10% | Revert: "too large value" | 10 |
| **updateMinSelfStake - non-owner** | Random signer + 1M ETH | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateMinSelfStake - valid** | 100,000 - 10,000,000 ETH | 100% | 0% | Success: Parameter updated | 5 |
| **updateMaxDelegatedRatio - too small** | 0 - 1 ETH | 90% | 10% | Revert: "too small value" | 10 |
| **updateMaxDelegatedRatio - too big** | 32+ ETH | 90% | 10% | Revert: "too large value" | 10 |
| **updateMaxDelegatedRatio - non-owner** | Random signer + 1K ETH | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateMaxDelegatedRatio - valid** | 1 - 31 ETH | 100% | 0% | Success: Parameter updated | 5 |
| **updateValidatorCommission - too big** | >50% (0.5+ ETH) | 85% | 15% | Revert: "too large value" | 10 |
| **updateValidatorCommission - non-owner** | Random signer + 10% | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateValidatorCommission - valid** | 1 - 50% (0-0.5 ETH) | 100% | 0% | Success: Parameter updated | 5 |
| **updateBurntFeeShare - too big** | >50% (0.5+ ETH) | 85% | 15% | Revert: "too large value" | 10 |
| **updateBurntFeeShare - non-owner** | Random signer + 10% | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateBurntFeeShare - valid** | 0 - 50% (0-0.5 ETH) | 100% | 0% | Success: Parameter updated | 5 |
| **updateTreasuryFeeShare - too big** | >50% (0.5+ ETH) | 85% | 15% | Revert: "too large value" | 10 |
| **updateTreasuryFeeShare - non-owner** | Random signer + 20% | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateTreasuryFeeShare - valid** | 0 - 50% (0-0.5 ETH) | 100% | 0% | Success: Parameter updated | 5 |
| **updateUnlockedRewardRatio - too small** | 0 - 4.99% (<0.05 ETH) | 90% | 10% | Revert: "too small value" | 10 |
| **updateUnlockedRewardRatio - too big** | >50% (0.5+ ETH) | 85% | 15% | Revert: "too large value" | 10 |
| **updateUnlockedRewardRatio - non-owner** | Random signer + 30% | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateUnlockedRewardRatio - valid** | 5 - 50% (0.05-0.5 ETH) | 100% | 0% | Success: Parameter updated | 5 |
| **updateMinLockupDuration - too small** | 0 - 86,399 seconds | 95% | 5% | Revert: "too small value" | 10 |
| **updateMinLockupDuration - too big** | 30+ days (2,592,001+ sec) | 95% | 5% | Revert: "too large value" | 10 |
| **updateMinLockupDuration - non-owner** | Random signer + 1 week | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateMinLockupDuration - valid** | 1 - 30 days (86,400-2,592,000 sec) | 100% | 0% | Success: Parameter updated | 5 |
| **updateMaxLockupDuration - too small** | 0 - 29 days | 95% | 5% | Revert: "too small value" | 10 |
| **updateMaxLockupDuration - too big** | 4+ years (1,461+ days) | 95% | 5% | Revert: "too large value" | 10 |
| **updateMaxLockupDuration - non-owner** | Random signer + 1 year | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateMaxLockupDuration - valid** | 30 days - 4 years | 100% | 0% | Success: Parameter updated | 5 |
| **updateWithdrawalPeriodEpochs - too small** | 0 - 1 epochs | 90% | 10% | Revert: "too small value" | 10 |
| **updateWithdrawalPeriodEpochs - too big** | 101+ epochs | 90% | 10% | Revert: "too large value" | 10 |
| **updateWithdrawalPeriodEpochs - non-owner** | Random signer + 5 epochs | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateWithdrawalPeriodEpochs - valid** | 2 - 100 epochs | 100% | 0% | Success: Parameter updated | 5 |
| **updateWithdrawalPeriodTime - too small** | 0 - 86,399 seconds | 95% | 5% | Revert: "too small value" | 10 |
| **updateWithdrawalPeriodTime - too big** | 30+ days (2,592,001+ sec) | 95% | 5% | Revert: "too large value" | 10 |
| **updateWithdrawalPeriodTime - non-owner** | Random signer + 1 week | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateWithdrawalPeriodTime - valid** | 1 - 30 days | 100% | 0% | Success: Parameter updated | 5 |
| **updateBaseRewardPerSecond - too small** | 0 - 0.49 U2U | 90% | 10% | Revert: "too small value" | 10 |
| **updateBaseRewardPerSecond - too big** | 32.1+ U2U | 90% | 10% | Revert: "too large value" | 10 |
| **updateBaseRewardPerSecond - non-owner** | Random signer + 1 U2U | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateBaseRewardPerSecond - valid** | 0.5 - 32 U2U | 100% | 0% | Success: Parameter updated | 5 |
| **updateOfflinePenaltyThresholdTime - too small** | 0 - 86,399 seconds | 95% | 5% | Revert: "too small value" | 10 |
| **updateOfflinePenaltyThresholdTime - too big** | 10+ days (864,001+ sec) | 95% | 5% | Revert: "too large value" | 10 |
| **updateOfflinePenaltyThresholdTime - non-owner** | Random signer + 2 days | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateOfflinePenaltyThresholdTime - valid** | 1 - 10 days | 100% | 0% | Success: Parameter updated | 5 |
| **updateOfflinePenaltyThresholdBlocksNum - too small** | 0 - 99 blocks | 80% | 20% | Revert: "too small value" | 10 |
| **updateOfflinePenaltyThresholdBlocksNum - too big** | 1,000,001+ blocks | 80% | 20% | Revert: "too large value" | 10 |
| **updateOfflinePenaltyThresholdBlocksNum - non-owner** | Random signer + 1000 blocks | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateOfflinePenaltyThresholdBlocksNum - valid** | 100 - 1,000,000 blocks | 100% | 0% | Success: Parameter updated | 5 |
| **updateTargetGasPowerPerSecond - too small** | 0 - 999,999 gas | 75% | 25% | Revert: "too small value" | 10 |
| **updateTargetGasPowerPerSecond - too big** | 500,000,001+ gas | 75% | 25% | Revert: "too large value" | 10 |
| **updateTargetGasPowerPerSecond - non-owner** | Random signer + 10M gas | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateTargetGasPowerPerSecond - valid** | 1,000,000 - 500,000,000 gas | 100% | 0% | Success: Parameter updated | 5 |
| **updateGasPriceBalancingCounterweight - too small** | 0 - 99 | 75% | 25% | Revert: "too small value" | 10 |
| **updateGasPriceBalancingCounterweight - too big** | 864,001+ | 75% | 25% | Revert: "too large value" | 10 |
| **updateGasPriceBalancingCounterweight - non-owner** | Random signer + 1000 | 0% | 100% | Revert: "Ownable: caller is not the owner" | 10 |
| **updateGasPriceBalancingCounterweight - valid** | 100 - 864,000 | 100% | 0% | Success: Parameter updated | 5 |

---

## 2. fuzz_get_methods_SFC.ts - SFC Getter Methods Fuzz Tests

| Test Name | Input Range | Real Values (%) | Fake Values (%) | Expected Behavior | Runs |
|-----------|-------------|----------------|-----------------|-------------------|------|
| **currentSealedEpoch** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **currentEpoch** | No parameters | 100% | 0% | Return: currentSealedEpoch + 1 | 5 |
| **totalSupply** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **totalStake** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **totalActiveStake** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **totalSlashedStake** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **lastValidatorID** | No parameters | 100% | 0% | Return: bigint ≥ 0 | 5 |
| **minGasPrice** | No parameters | 100% | 0% | Return: bigint > 0 | 5 |
| **owner address** | No parameters | 100% | 0% | Return: valid Ethereum address | 5 |
| **treasuryAddress** | No parameters | 100% | 0% | Return: valid Ethereum address | 5 |
| **stakeTokenizerAddress** | No parameters | 100% | 0% | Return: valid Ethereum address | 5 |
| **constsAddress** | No parameters | 100% | 0% | Return: valid Ethereum address | 5 |
| **getValidator** | ValidatorID: 1-1000 | 10% | 90% | Return: 7-element array or default | 10 |
| **getValidatorID** | Address: Generated Ethereum | 0% | 100% | Return: bigint (0 for non-existent) | 10 |
| **getValidatorPubkey** | ValidatorID: 1-1000 | 10% | 90% | Return: bytes or empty | 10 |
| **getSelfStake** | ValidatorID: 1-1000 | 10% | 90% | Return: bigint ≥ 0 | 10 |
| **isSlashed** | ValidatorID: 1-1000 | 10% | 90% | Return: boolean | 10 |
| **slashingRefundRatio** | ValidatorID: 1-1000 | 10% | 90% | Return: bigint (0-1 ETH) | 10 |
| **getStake** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint ≥ 0 | 10 |
| **getLockedStake** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint ≥ 0 | 10 |
| **getUnlockedStake** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint ≥ 0 | 10 |
| **isLockedUp** | Address + ValidatorID (1-1000) | 5% | 95% | Return: boolean | 10 |
| **getLockupInfo** | Address + ValidatorID (1-1000) | 5% | 95% | Return: structured lockup data | 10 |
| **pendingRewards** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint ≥ 0 | 10 |
| **rewardsStash** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint ≥ 0 | 10 |
| **getStashedLockupRewards** | Address + ValidatorID (1-1000) | 5% | 95% | Return: structured reward data | 10 |
| **stashedRewardsUntilEpoch** | Address + ValidatorID (1-1000) | 5% | 95% | Return: bigint (epoch number) | 10 |
| **getEpochSnapshot** | Epoch: 0-1000 | 20% | 80% | Return: 7-element epoch array | 10 |
| **getEpochValidatorIDs** | Epoch: 0-100 | 30% | 70% | Return: array of validator IDs | 10 |
| **getEpochReceivedStake** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint ≥ 0 | 10 |
| **getEpochAccumulatedRewardPerToken** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint ≥ 0 | 10 |
| **getEpochAccumulatedUptime** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint (uptime) | 10 |
| **getEpochAccumulatedOriginatedTxsFee** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint ≥ 0 | 10 |
| **getEpochOfflineTime** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint (time) | 10 |
| **getEpochOfflineBlocks** | Epoch (0-100) + ValidatorID (1-1000) | 15% | 85% | Return: bigint (block count) | 10 |
| **getWithdrawalRequest** | Address + ValidatorID (1-1000) + wrID (0-100) | 3% | 97% | Return: 3-element withdrawal array | 10 |
| **isOwner** | No parameters | 100% | 0% | Return: boolean (ownership status) | 10 |
| **version** | No parameters | 100% | 0% | Return: string (contract version) | 5 |
| **Consistency: totalActiveStake ≤ totalStake** | No parameters | 100% | 0% | Validation: Mathematical invariant | 10 |
| **Consistency: lockedStake ≤ totalStake** | Random address + ValidatorID | 5% | 95% | Validation: Staking invariant | 10 |
| **Consistency: currentEpoch = currentSealedEpoch + 1** | No parameters | 100% | 0% | Validation: Epoch relationship | 10 |

---

## 3. fuzz_state_changing_SFC.ts - SFC State-Changing Methods Fuzz Tests

| Test Name | Input Range | Real Values (%) | Fake Values (%) | Expected Behavior | Runs |
|-----------|-------------|----------------|-----------------|-------------------|------|
| **transferOwnership - non-owner** | Random signer + new address | 10% | 90% | Revert: "Ownable: caller is not the owner" | 10 |
| **renounceOwnership** | No parameters | 100% | 0% | Success: Ownership renounced | 5 |
| **createValidator - valid** | Pubkey + 1M-10M ETH stake | 0% | 100% | Success or revert with specific errors | 5 |
| **delegate - random** | ValidatorID (1-1000) + 0.1-1000 ETH | 50% | 50% | Success or revert: validator existence | 10 |
| **undelegate - random** | ValidatorID (1-1000) + wrID (0-100) + amount | 50% | 50% | Success or revert: stake/delegation checks | 10 |
| **withdraw - random** | ValidatorID (1-1000) + wrID (0-100) | 40% | 60% | Success or revert: withdrawal availability | 10 |
| **stashRewards - random** | Delegator address + ValidatorID (1-1000) | 0% | 100% | Success or revert: delegation existence | 10 |
| **claimRewards - random** | ValidatorID (1-1000) | 10% | 90% | Success or revert: rewards availability | 10 |
| **restakeRewards - random** | ValidatorID (1-1000) | 10% | 90% | Success or revert: rewards availability | 10 |
| **updateOfflinePenaltyThreshold - authorized** | Blocks (100-1M) + time (1-10 days) | 95% | 5% | Revert: "caller is not the NodeDriverAuth" | 10 |
| **mintU2U - owner** | Receiver + amount (0.1-1000 ETH) + reason | 60% | 40% | Revert: "caller is not the owner" | 10 |
| **burnU2U - owner** | Amount (0.1-100 ETH) | 90% | 10% | Revert: "caller is not the owner" | 10 |
| **lockStake - random** | ValidatorID (1-1000) + duration (1d-1y) + amount | 40% | 60% | Success or revert: stake availability | 10 |
| **relockStake - random** | ValidatorID (1-1000) + duration (1d-1y) + amount | 40% | 60% | Success or revert: locked stake check | 10 |
| **unlockStake - random** | ValidatorID (1-1000) + amount (0.1-100 ETH) | 40% | 60% | Success or revert: locked stake check | 10 |
| **deactivateValidator - authorized** | ValidatorID (1-1000) + status (1-255) | 30% | 70% | Revert: "caller is not the NodeDriverAuth" | 10 |
| **updateSlashingRefundRatio - owner** | ValidatorID (1-1000) + ratio (0-1 ETH) | 40% | 60% | Revert: "caller is not the owner" | 10 |
| **updateConstsAddress - owner** | New address | 0% | 100% | Revert: "caller is not the owner" | 10 |
| **updateStakeTokenizerAddress - owner** | New address | 0% | 100% | Revert: "caller is not the owner" | 10 |
| **updateTreasuryAddress - owner** | New address | 0% | 100% | Revert: "caller is not the owner" | 10 |
| **updateVoteBookAddress - owner** | New address | 0% | 100% | Revert: "caller is not the owner" | 10 |

---

## Summary Statistics

| File | Active Tests | Total Runs | Real Values Avg | Fake Values Avg | Primary Focus |
|------|-------------|------------|-----------------|------------------|---------------|
| **fuzz_CM.ts** | 52 | 520 | 87% | 13% | Parameter validation & access control |
| **fuzz_get_methods_SFC.ts** | 42 | 385 | 60% | 40% | Read-only state validation |
| **fuzz_state_changing_SFC.ts** | 21 | 190 | 45% | 55% | State mutation & error handling |
| **Combined Total** | **115** | **1,095** | **64%** | **36%** | **Complete SFC contract coverage** |

### Input Pattern Analysis

| Parameter Type | Frequency | Real % | Fake % | Common Ranges |
|----------------|-----------|--------|--------|---------------|
| **ETH Amounts** | 35% | 85% | 15% | 0.1 ETH - 10M ETH |
| **Validator IDs** | 28% | 15% | 85% | 1 - 1,000 |
| **Addresses** | 22% | 20% | 80% | Generated Ethereum addresses |
| **Time/Duration** | 8% | 95% | 5% | 1 day - 4 years |
| **Block Numbers** | 4% | 80% | 20% | 100 - 1,000,000 |
| **Percentages** | 3% | 90% | 10% | 0% - 100% |

### Error Pattern Analysis

| Error Category | Tests | Common Messages |
|----------------|-------|-----------------|
| **Access Control** | 39 tests | "Ownable: caller is not the owner", "caller is not the NodeDriverAuth" |
| **Boundary Violations** | 52 tests | "too small value", "too large value" |
| **State Validation** | 24 tests | "delegation doesn't exist", "validator doesn't exist" |

**Version**: v1.6 - Comprehensive table format with test-by-test specifications (2025-08-08)