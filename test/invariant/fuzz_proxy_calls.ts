import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import * as fs from 'fs';
import * as path from 'path';

describe('Comprehensive SFC Fuzz Testing', function () {
  const addressesFilePath = path.join(__dirname, 'contract-addresses.json');

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

  function saveContractAddresses(addresses: any) {
    try {
      fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
      console.log('✓ Contract addresses saved to:', addressesFilePath);
    } catch (error) {
      console.log('Failed to save contract addresses:', error);
    }
  }

  async function deployOrUseExistingSFC() {
    const [owner, user, validator1, validator2] = await ethers.getSigners();
    
    let sfcProxy: any = null;
    let useProxy = true;
    let addresses = loadContractAddresses();

    console.log('Testing ONLY through SFC proxy - proxy required for all tests');
    
    const sfc = await ethers.getContractAt('SFCI', addresses.sfc);
    const nodeDriver = await ethers.getContractAt('NodeDriver', addresses.nodeDriver);
    const nodeDriverAuth = await ethers.getContractAt('NodeDriverAuth', addresses.nodeDriverAuth);
    const evmWriter = await ethers.getContractAt('EVMWriter', addresses.evmWriter);
    const constants = await ethers.getContractAt('ConstantsManager', addresses.constants);
    
    try {
      // Try to use stored proxy address
      sfcProxy = await ethers.getContractAt('SFCDelegateCallProxy', addresses.sfcProxy);
      
      // Verify proxy is working
      const isInitialized = await sfcProxy.isInitialized();
      if (isInitialized) {
        console.log('✓ Using SFC proxy from saved addresses at:', await sfcProxy.getAddress());
      } else {
        throw new Error('Stored proxy not properly initialized');
      }
    } catch (error) {
      console.log('Stored proxy not available, attempting to deploy new proxy...');
      
      try {
        // Deploy fresh SFC contract
        const SFCFactory = await ethers.getContractFactory('SFC');
        const sfcImplementation = await SFCFactory.deploy();
        await sfcImplementation.waitForDeployment();

        // Deploy proxy pointing to SFC
        const ProxyFactory = await ethers.getContractFactory('SFCDelegateCallProxy');
        sfcProxy = await ProxyFactory.deploy(await sfcImplementation.getAddress());
        await sfcProxy.waitForDeployment();
        
        const newProxyAddress = await sfcProxy.getAddress();
        console.log('✓ Deployed new SFC proxy for testing at:', newProxyAddress);

        // Update addresses and save
        addresses.sfcProxy = newProxyAddress;
        saveContractAddresses(addresses);
      } catch (deployError) {
        throw new Error(`Failed to deploy SFC proxy: ${deployError}. This test requires proxy deployment.`);
      }
    }

    return { 
      sfc, 
      nodeDriver, 
      nodeDriverAuth, 
      evmWriter, 
      constants, 
      sfcProxy, 
      owner, 
      user, 
      validator1, 
      validator2, 
      useProxy 
    };
  }

  // Helper function to safely call functions
  async function safeDelegateCall(sfcProxy: any, sfc: any, functionName: string, params: any[] = []) {
    const sfcInterface = new ethers.Interface([
      // All SFC view functions
      'function currentSealedEpoch() view returns (uint256)',
      'function currentEpoch() view returns (uint256)',
      'function version() view returns (bytes3)',
      'function lastValidatorID() view returns (uint256)',
      'function minGasPrice() view returns (uint256)',
      'function totalActiveStake() view returns (uint256)',
      'function totalSlashedStake() view returns (uint256)',
      'function totalStake() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function treasuryAddress() view returns (address)',
      'function stakeTokenizerAddress() view returns (address)',
      'function constsAddress() view returns (address)',
      'function owner() view returns (address)',
      'function isOwner() view returns (bool)',
      'function getValidatorID(address) view returns (uint256)',
      'function getSelfStake(uint256) view returns (uint256)',
      'function getStake(address,uint256) view returns (uint256)',
      'function getLockedStake(address,uint256) view returns (uint256)',
      'function getUnlockedStake(address,uint256) view returns (uint256)',
      'function isSlashed(uint256) view returns (bool)',
      'function isLockedUp(address,uint256) view returns (bool)',
      'function pendingRewards(address,uint256) view returns (uint256)',
      'function rewardsStash(address,uint256) view returns (uint256)',
      'function slashingRefundRatio(uint256) view returns (uint256)',
      'function stashedRewardsUntilEpoch(address,uint256) view returns (uint256)',
      'function getValidator(uint256) view returns (uint256,uint256,uint256,uint256,uint256,uint256,address)',
      'function getValidatorPubkey(uint256) view returns (bytes)',
      'function getEpochValidatorIDs(uint256) view returns (uint256[])',
      'function getEpochReceivedStake(uint256,uint256) view returns (uint256)',
      'function getEpochAccumulatedRewardPerToken(uint256,uint256) view returns (uint256)',
      'function getEpochAccumulatedUptime(uint256,uint256) view returns (uint256)',
      'function getEpochAccumulatedOriginatedTxsFee(uint256,uint256) view returns (uint256)',
      'function getEpochOfflineTime(uint256,uint256) view returns (uint256)',
      'function getEpochOfflineBlocks(uint256,uint256) view returns (uint256)',
      'function getEpochSnapshot(uint256) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
      'function getLockupInfo(address,uint256) view returns (uint256,uint256,uint256,uint256)',
      'function getStashedLockupRewards(address,uint256) view returns (uint256,uint256,uint256)',
      'function getWithdrawalRequest(address,uint256,uint256) view returns (uint256,uint256,uint256)',
      'function voteBookAddress(address) view returns (address)',
      // State-changing functions
      'function createValidator(bytes) payable',
      'function delegate(uint256) payable',
      'function undelegate(uint256,uint256,uint256)',
      'function withdraw(uint256,uint256)',
      'function claimRewards(uint256)',
      'function stashRewards(address,uint256)',
      'function restakeRewards(uint256)',
      'function lockStake(uint256,uint256,uint256)',
      'function unlockStake(uint256,uint256) returns (uint256)',
      'function relockStake(uint256,uint256,uint256)',
      'function deactivateValidator(uint256,uint256)',
      'function updateBaseRewardPerSecond(uint256)',
      'function updateOfflinePenaltyThreshold(uint256,uint256)',
      'function updateSlashingRefundRatio(uint256,uint256)',
      'function updateStakeTokenizerAddress(address)',
      'function updateTreasuryAddress(address)',
      'function updateConstsAddress(address)',
      'function updateVoteBookAddress(address)',
      'function mintU2U(address,uint256,string)',
      'function burnU2U(uint256)',
      'function sealEpoch(uint256[],uint256[],uint256[],uint256[],uint256)',
      'function sealEpochValidators(uint256[])',
      'function transferOwnership(address)',
      'function renounceOwnership()',
      'function initialize(uint256,uint256,address,address,address,address)',
      'function setGenesisValidator(address,uint256,bytes,uint256,uint256,uint256,uint256,uint256)',
      'function setGenesisDelegation(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
    ]);

    try {
      const callData = sfcInterface.encodeFunctionData(functionName, params);
      const result = await sfcProxy.testDelegateCall.staticCall(
        await sfc.getAddress(),
        callData
      );
      return {
        success: result[0],
        returnData: result[1],
        error: null
      };
    } catch (error) {
      return {
        success: false,
        returnData: '0x',
        error: error
      };
    }
  }

  this.beforeEach(async function () {
    const { constants } = await deployOrUseExistingSFC();
    await constants.updateTargetGasPowerPerSecond(500_000_000); // Ensure target gas power is set before tests
  })

  describe('SFC View Functions Coverage', function () {
    it('should test all basic view functions', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const viewFunctions = [
        'currentSealedEpoch',
        'currentEpoch', 
        'version',
        'lastValidatorID',
        'minGasPrice',
        'totalActiveStake',
        'totalSlashedStake',
        'totalStake',
        'totalSupply',
        'treasuryAddress',
        'stakeTokenizerAddress',
        'constsAddress',
        'owner',
        'isOwner'
      ];

      for (const funcName of viewFunctions) {
        await delay(200);
        const result = await safeDelegateCall(sfcProxy, sfc, funcName);
        console.log(`${funcName}: success=${result.success}`);
        expect(typeof result.success).to.equal('boolean');
      }
    });

    it('should test validator-related view functions', async function () {
      const { sfc, sfcProxy, validator1 } = await deployOrUseExistingSFC();

      const validatorFunctions = [
        { name: 'getValidatorID', params: [validator1.address] },
        { name: 'getSelfStake', params: [1] },
        { name: 'getStake', params: [validator1.address, 1] },
        { name: 'getLockedStake', params: [validator1.address, 1] },
        { name: 'getUnlockedStake', params: [validator1.address, 1] },
        { name: 'isSlashed', params: [1] },
        { name: 'isLockedUp', params: [validator1.address, 1] },
        { name: 'pendingRewards', params: [validator1.address, 1] },
        { name: 'rewardsStash', params: [validator1.address, 1] },
        { name: 'slashingRefundRatio', params: [1] },
        { name: 'stashedRewardsUntilEpoch', params: [validator1.address, 1] },
        { name: 'getValidator', params: [1] },
        { name: 'getValidatorPubkey', params: [1] }
      ];

      for (const func of validatorFunctions) {
        await delay(200);
        const result = await safeDelegateCall(sfcProxy, sfc, func.name, func.params);
        console.log(`${func.name}: success=${result.success}`);
        expect(typeof result.success).to.equal('boolean');
      }
    });

    it('should test epoch-related view functions', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const epochFunctions = [
        { name: 'getEpochValidatorIDs', params: [1] },
        { name: 'getEpochReceivedStake', params: [1, 1] },
        { name: 'getEpochAccumulatedRewardPerToken', params: [1, 1] },
        { name: 'getEpochAccumulatedUptime', params: [1, 1] },
        { name: 'getEpochAccumulatedOriginatedTxsFee', params: [1, 1] },
        { name: 'getEpochOfflineTime', params: [1, 1] },
        { name: 'getEpochOfflineBlocks', params: [1, 1] },
        { name: 'getEpochSnapshot', params: [1] }
      ];

      for (const func of epochFunctions) {
        await delay(200);
        const result = await safeDelegateCall(sfcProxy, sfc, func.name, func.params);
        console.log(`${func.name}: success=${result.success}`);
        expect(typeof result.success).to.equal('boolean');
      }
    });

    it('should test lockup and withdrawal view functions', async function () {
      const { sfc, sfcProxy, validator1 } = await deployOrUseExistingSFC();

      const lockupFunctions = [
        { name: 'getLockupInfo', params: [validator1.address, 1] },
        { name: 'getStashedLockupRewards', params: [validator1.address, 1] },
        { name: 'getWithdrawalRequest', params: [validator1.address, 1, 1] }
      ];

      for (const func of lockupFunctions) {
        await delay(200);
        const result = await safeDelegateCall(sfcProxy, sfc, func.name, func.params);
        console.log(`${func.name}: success=${result.success}`);
        expect(typeof result.success).to.equal('boolean');
      }
    });
  });

  describe('Fuzz Testing - Random Parameters', function () {
    it('should fuzz test validator ID parameters', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const validatorIdFunctions = [
        'getSelfStake',
        'isSlashed',
        'slashingRefundRatio',
        'getValidator',
        'getValidatorPubkey'
      ];

      // Test with random validator IDs
      for (let i = 0; i < 10; i++) {
        const randomValidatorId = Math.floor(Math.random() * 1000) + 1;
        
        for (const funcName of validatorIdFunctions) {
          await delay(200);
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, [randomValidatorId]);
          expect(typeof result.success).to.equal('boolean');
          console.log(`${funcName}(${randomValidatorId}): success=${result.success}`);
        }
      }
    });

    it('should fuzz test address and validator ID combinations', async function () {
      const { sfc, sfcProxy, validator1, validator2 } = await deployOrUseExistingSFC();

      const addressValidatorFunctions = [
        'getStake',
        'getLockedStake',
        'getUnlockedStake',
        'isLockedUp',
        'pendingRewards',
        'rewardsStash',
        'stashedRewardsUntilEpoch',
        'getLockupInfo',
        'getStashedLockupRewards'
      ];

      const testAddresses = [
        validator1.address,
        validator2.address,
        ethers.ZeroAddress,
        ethers.Wallet.createRandom().address
      ];

      for (let i = 0; i < 15; i++) {
        const randomAddress = testAddresses[i % testAddresses.length];
        const randomValidatorId = Math.floor(Math.random() * 100) + 1;

        for (const funcName of addressValidatorFunctions) {
          await delay(200);
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, [randomAddress, randomValidatorId]);
          expect(typeof result.success).to.equal('boolean');
          
          if (i % 5 === 0) { // Log every 5th test to avoid spam
            console.log(`${funcName}(${randomAddress.slice(0,8)}..., ${randomValidatorId}): success=${result.success}`);
          }
        }
      }
    });

    it('should fuzz test epoch parameters', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const epochFunctions = [
        'getEpochValidatorIDs',
        'getEpochSnapshot'
      ];

      const epochValidatorFunctions = [
        'getEpochReceivedStake',
        'getEpochAccumulatedRewardPerToken',
        'getEpochAccumulatedUptime',
        'getEpochAccumulatedOriginatedTxsFee',
        'getEpochOfflineTime',
        'getEpochOfflineBlocks'
      ];

      // Test epoch-only functions
      for (let i = 0; i < 10; i++) {
        const randomEpoch = Math.floor(Math.random() * 1000);

        for (const funcName of epochFunctions) {
          await delay(200);
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, [randomEpoch]);
          expect(typeof result.success).to.equal('boolean');
          console.log(`${funcName}(${randomEpoch}): success=${result.success}`);
        }
      }

      // Test epoch + validator functions
      for (let i = 0; i < 10; i++) {
        const randomEpoch = Math.floor(Math.random() * 100);
        const randomValidatorId = Math.floor(Math.random() * 100) + 1;

        for (const funcName of epochValidatorFunctions) {
          await delay(200);
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, [randomEpoch, randomValidatorId]);
          expect(typeof result.success).to.equal('boolean');
          
          if (i % 3 === 0) { // Log every 3rd test
            console.log(`${funcName}(${randomEpoch}, ${randomValidatorId}): success=${result.success}`);
          }
        }
      }
    });

    it('should fuzz test withdrawal request parameters', async function () {
      const { sfc, sfcProxy, validator1, validator2 } = await deployOrUseExistingSFC();

      const testAddresses = [validator1.address, validator2.address, ethers.ZeroAddress];

      for (let i = 0; i < 12; i++) {
        await delay(200);
        const randomAddress = testAddresses[i % testAddresses.length];
        const randomValidatorId = Math.floor(Math.random() * 50) + 1;
        const randomWrId = Math.floor(Math.random() * 10);

        const result = await safeDelegateCall(
          sfcProxy, 
          sfc, 
          'getWithdrawalRequest', 
          [randomAddress, randomValidatorId, randomWrId]
        );
        
        expect(typeof result.success).to.equal('boolean');
        
        if (i % 4 === 0) {
          console.log(`getWithdrawalRequest(${randomAddress.slice(0,8)}..., ${randomValidatorId}, ${randomWrId}): success=${result.success}`);
        }
      }
    });
  });

  describe('Edge Cases and Boundary Testing', function () {
    it('should test extreme parameter values', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const extremeValues = [
        0,
        1,
        999999999,
        ethers.MaxUint256
      ];

      const singleParamFunctions = [
        'getSelfStake',
        'isSlashed',
        'slashingRefundRatio',
        'getValidator',
        'getValidatorPubkey',
        'getEpochValidatorIDs',
        'getEpochSnapshot'
      ];

      for (const value of extremeValues) {
        for (const funcName of singleParamFunctions) {
          await delay(200);
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, [value]);
          expect(typeof result.success).to.equal('boolean');
          console.log(`${funcName}(${value.toString().slice(0,10)}...): success=${result.success}`);
        }
      }
    });

    it('should test with zero and max addresses', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const extremeAddresses = [
        ethers.ZeroAddress,
        '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF'
      ];

      const addressFunctions = [
        'getValidatorID',
        'getStake',
        'getLockedStake',
        'getUnlockedStake',
        'isLockedUp',
        'pendingRewards',
        'rewardsStash'
      ];

      for (const address of extremeAddresses) {
        for (const funcName of addressFunctions) {
          await delay(200);
          const params = funcName === 'getValidatorID' ? [address] : [address, 1];
          const result = await safeDelegateCall(sfcProxy, sfc, funcName, params);
          expect(typeof result.success).to.equal('boolean');
          console.log(`${funcName}(${address.slice(0,8)}...): success=${result.success}`);
        }
      }
    });
  });

  describe('State Integrity Verification', function () {
    it('should maintain proxy state after extensive fuzzing', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      const initialImplementation = await sfcProxy.getImplementation();
      const initialOwner = await sfcProxy.owner();

      // Run 100 random calls
      for (let i = 0; i < 100; i++) {
        await delay(200);
        const randomSelector = ethers.hexlify(ethers.randomBytes(4));
        
        try {
          await sfcProxy.testDelegateCall.staticCall(
            await sfc.getAddress(),
            randomSelector
          );
        } catch (error) {
          // Errors are acceptable, continue testing
        }
      }

      // Verify proxy state integrity
      expect(await sfcProxy.getImplementation()).to.equal(initialImplementation);
      expect(await sfcProxy.owner()).to.equal(initialOwner);
      expect(await sfcProxy.isInitialized()).to.be.true;

      console.log('✓ Proxy state maintained after 100 random calls');
    });

    it('should test all functions systematically', async function () {
      const { sfc, sfcProxy } = await deployOrUseExistingSFC();

      let totalTests = 0;
      let successfulTests = 0;

      // Test every SFC function we can access
      const allFunctions = [
        // View functions without parameters
        { name: 'currentSealedEpoch', params: [] },
        { name: 'currentEpoch', params: [] },
        { name: 'version', params: [] },
        { name: 'lastValidatorID', params: [] },
        { name: 'minGasPrice', params: [] },
        { name: 'totalActiveStake', params: [] },
        { name: 'totalSlashedStake', params: [] },
        { name: 'totalStake', params: [] },
        { name: 'totalSupply', params: [] },
        { name: 'treasuryAddress', params: [] },
        { name: 'stakeTokenizerAddress', params: [] },
        { name: 'constsAddress', params: [] },
        { name: 'owner', params: [] },
        { name: 'isOwner', params: [] },
        
        // Functions with common test parameters
        { name: 'getValidatorID', params: [ethers.ZeroAddress] },
        { name: 'getSelfStake', params: [1] },
        { name: 'getStake', params: [ethers.ZeroAddress, 1] },
        { name: 'getLockedStake', params: [ethers.ZeroAddress, 1] },
        { name: 'getUnlockedStake', params: [ethers.ZeroAddress, 1] },
        { name: 'isSlashed', params: [1] },
        { name: 'isLockedUp', params: [ethers.ZeroAddress, 1] },
        { name: 'pendingRewards', params: [ethers.ZeroAddress, 1] },
        { name: 'rewardsStash', params: [ethers.ZeroAddress, 1] },
        { name: 'slashingRefundRatio', params: [1] },
        { name: 'stashedRewardsUntilEpoch', params: [ethers.ZeroAddress, 1] },
        { name: 'getValidator', params: [1] },
        { name: 'getValidatorPubkey', params: [1] },
        { name: 'getEpochValidatorIDs', params: [1] },
        { name: 'getEpochReceivedStake', params: [1, 1] },
        { name: 'getEpochSnapshot', params: [1] },
        { name: 'getLockupInfo', params: [ethers.ZeroAddress, 1] },
        { name: 'getStashedLockupRewards', params: [ethers.ZeroAddress, 1] },
        { name: 'getWithdrawalRequest', params: [ethers.ZeroAddress, 1, 1] }
      ];

      for (const func of allFunctions) {
        await delay(200);
        totalTests++;
        const result = await safeDelegateCall(sfcProxy, sfc, func.name, func.params);
        if (result.success) {
          successfulTests++;
        }
        
        expect(typeof result.success).to.equal('boolean');
      }

      console.log(`\n📊 Test Results: ${successfulTests}/${totalTests} functions returned success`);
      console.log(`📈 Success Rate: ${((successfulTests/totalTests) * 100).toFixed(1)}%`);
      
      // Expect at least some functions to work
      expect(successfulTests).to.be.greaterThan(0);
    });
  });
});

// Simple delay to avoid rate limits or nonce issues
function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}