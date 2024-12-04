# Special Fee Contract

The SFC (Special Fee Contract) maintains a group of validators and their delegations.

It distributes the rewards, based on internal transaction created by the Opera node.

# Compile

1. `yarn build`

Build output can be found in `build/`

# Test

1. `yarn test`

If everything is all right, it should output something along this:
```
  SFC
    Node
      ✔ Should migrate to New address
      ✔ Should not migrate if not owner
      ✔ Should not copyCode if not owner
      ✔ Should copyCode
      ✔ Should update network version
      ✔ Should not update network version if not owner
      ✔ Should advance epoch
      ✔ Should not set a new storage if not backend address
      ✔ Should not advance epoch if not owner
      ✔ Should not set backend if not backend address
      ✔ Should not swap code if not backend address
      ✔ Should not add a Genesis Validator through NodeDriver if not called by Node
      ✔ Should not deactivate a validator through NodeDriver if not called by Node
      ✔ Should not add a Genesis Delegation through NodeDriver if not called by Node
      ✔ Should not seal Epoch Validators through NodeDriver if not called by Node
      ✔ Should not seal Epoch through NodeDriver if not called by Node
    Genesis Validator
      ✔ Set Genesis Validator with bad Status
      ✔ should reject sealEpoch if not called by Node
      ✔ should reject SealEpochValidators if not called by Node

  Basic Functions
    Constants
      ✔ Returns current Epoch
      ✔ Returns minimum amount to stake for a Validator
      ✔ Returns the maximum ratio of delegations a validator can have
      ✔ Returns commission fee in percentage a validator will get from a delegation
      ✔ Returns burntFeeShare
      ✔ Returns treasuryFeeShare
      ✔ Returns the ratio of the reward rate at base rate (without lockup)
      ✔ Returns the minimum duration of a stake/delegation lockup
      ✔ Returns the maximum duration of a stake/delegation lockup
      ✔ Returns the period of time that stake is locked
      ✔ Returns the number of epochs that stake is locked
      ✔ Returns the version of the current implementation
      ✔ Should create a Validator and return the ID
      ✔ Should fail to create a Validator with insufficient self-stake
      ✔ Should fail if pubkey is empty
      ✔ Should create two Validators and return the correct last validator ID
      ✔ Should return current Sealed Epoch
      ✔ Should return getTime()

  Create Validator
    ✔ Should create Validators
    ✔ Should return the right ValidatorID by calling getValidatorID
    ✔ Should not be able to stake if Validator not created yet
    ✔ Should stake with different delegators
    ✔ Should return the amount of delegated for each Delegator
    ✔ Should return the total of received Stake

  Returns Validator
    ✔ Should return Validator's status
    ✔ Should return Validator's Deactivated Time
    ✔ Should return Validator's Deactivated Epoch
    ✔ Should return Validator's Received Stake
    ✔ Should return Validator's Created Epoch
    ✔ Should return Validator's Created Time
    ✔ Should return Validator's Auth (address)

  EpochSnapshot
    ✔ Returns stashedRewardsUntilEpoch

  Methods tests
    ✔ checking createValidator function
    ✔ checking sealing epoch
    ✔ balances gas price (81ms)

  Staking / Sealed
    Staking / Sealed Epoch functions
      ✔ Should return claimed Rewards until Epoch
      ✔ Check pending Rewards of delegators
      ✔ Check if pending Rewards have been increased after sealing Epoch
      ✔ Should increase balances after claiming Rewards
      ✔ Should increase locked stake after restaking Rewards
      ✔ Should return stashed Rewards
      ✔ Should update the validator on node
      ✔ Should not be able to deactivate validator if not Node
      ✔ Should seal Epochs
      ✔ Should seal Epoch on Validators
    Stake lockup
      ✔ Check pending Rewards of delegators
      ✔ Check if pending Rewards have been increased after sealing Epoch
      ✔ Should increase balances after claiming Rewards
      ✔ Should return stashed Rewards
      ✔ Should return pending rewards after unlocking and re-locking (113ms)
    NodeDriver
      ✔ Should not be able to call `setGenesisValidator` if not NodeDriver
      ✔ Should not be able to call `setGenesisDelegation` if not NodeDriver
      ✔ Should not be able to call `deactivateValidator` if not NodeDriver
      ✔ Should not be able to call `deactivateValidator` with wrong status
      ✔ Should deactivate Validator
      ✔ Should not be able to call `sealEpochValidators` if not NodeDriver
      ✔ Should not be able to call `sealEpoch` if not NodeDriver
    Epoch getters
Validator IDs: Result(0) []
      ✔ should return Epoch validator IDs
Received Stake: 0
      ✔ should return the Epoch Received Stake
Accumulated Reward Per Token: 0
      ✔ should return the Epoch Accumulated Reward Per Token
Accumulated Uptime: 0
      ✔ should return the Epoch Accumulated Uptime
Accumulated Originated Txs Fee: 0
      ✔ should return the Epoch Accumulated Originated Txs Fee
Offline Time: 0
      ✔ should return the Epoch Offline Time
Offline Blocks: 0
      ✔ should return Epoch Offline Blocks
    Unlock features
      ✔ should fail if trying to unlock stake when not locked
      ✔ should fail if trying to unlock stake with amount 0
Is Validator Slashed: false
      ✔ should return whether the validator is slashed
      ✔ should fail if delegating to a non-existing validator
      ✔ should fail if delegating to a non-existing validator with value
    SFC Rewards getters / Features
Rewards Stash: 0
      ✔ should return stashed rewards
Locked Stake for Validator 1: 0
      ✔ should return locked stake for Validator 1
Locked Stake for Validator 2: 0
      ✔ should return locked stake for Validator 2

  Staking / Sealed Epoch functions
    ✔ Should set Genesis Delegation for a Validator

  Test Rewards Calculation
    ✔ Calculation of validators rewards should be equal to 30%
    ✔ Should not be able withdraw if request does not exist
    ✔ Should not be able to undelegate 0 amount
    ✔ Should not be able to undelegate if not enough unlocked stake
    ✔ Should not be able to unlock if not enough unlocked stake
    ✔ should return the unlocked stake
    ✔ should return the unlocked stake
    ✔ Should not be able to claim Rewards if 0 rewards

  Test Calculation Rewards with Lockup
    ✔ Should not be able to lock 0 amount
    ✔ Should not be able to lock more than a year
    ✔ Should not be able to lock more than validator lockup period
    ✔ Should be able to lock for 1 month
    ✔ Should not unlock if not locked up U2U
    ✔ Should not be able to unlock more than locked stake
    ✔ Should scale unlocking penalty
    ✔ Should unlock after period ended and stash rewards

  Test Rewards with lockup Calculation
    ✔ Should not update slashing refund ratio
    ✔ Should not sync if validator does not exist


  110 passing (2s)

Done in 2.93s.
```
