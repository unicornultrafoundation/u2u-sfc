# SFC Delegate Call Proxy for Fuzz Testing

This document explains how to use the `SFCDelegateCallProxy` contract for comprehensive fuzz testing of the SFC (Staking and Fee Collection) contract implementation.

## Overview

The `SFCDelegateCallProxy` contract provides a safe way to test delegate call functionality by:

1. **Proxying calls** to the SFC implementation contract
2. **Tracking call results** for analysis  
3. **Maintaining state integrity** during fuzz testing
4. **Supporting batch operations** for efficient testing
5. **Automatic deployment** when pre-deployed contracts aren't available
6. **JSON-based address management** for consistent testing across environments

## Architecture

```
┌─────────────────┐    delegatecall    ┌─────────────────┐
│                 │───────────────────▶│                 │
│ SFCDelegateCall │                    │ SFC             │
│ Proxy           │◀───────────────────│ Implementation  │
│                 │    return data     │                 │
└─────────────────┘                    └─────────────────┘
```

## Key Features

### 1. Safe Delegate Call Testing

```solidity
function testDelegateCall(address _target, bytes memory _data) 
    public 
    payable 
    returns (bool success, bytes memory returnData);
```

- Returns success/failure status instead of reverting
- Captures return data for analysis
- Emits events for monitoring

### 2. Batch Testing

```solidity
function batchDelegateCall(address[] memory _targets, bytes[] memory _calls)
    public
    payable
    returns (bool[] memory results, bytes[] memory returnData);
```

- Execute multiple delegate calls in one transaction
- Efficient for testing multiple scenarios
- Individual call failures don't stop the batch

### 3. State Protection

- Proxy state remains isolated from SFC state changes
- Implementation address can be updated safely
- Owner-only administrative functions

## Usage Examples

### Basic Fuzz Testing

```typescript
import fc from 'fast-check';
import { SFCDelegateCallProxy } from '../typechain-types';

// Test random function selectors
await fc.assert(
  fc.asyncProperty(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    async (selector) => {
      const callData = '0x' + selector;
      const [success, returnData] = await proxy.testDelegateCall(
        sfcAddress,
        callData
      );
      
      // Verify proxy remains stable
      expect(await proxy.isInitialized()).to.be.true;
    }
  )
);
```

### Testing Specific SFC Functions

```typescript
// Test SFC view functions through the comprehensive test helper
async function safeDelegateCall(sfcProxy: any, sfc: any, functionName: string, params: any[] = []) {
  const sfcInterface = new ethers.Interface([
    'function currentEpoch() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    // Add more function signatures as needed
  ]);

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
}

// Usage example
const result = await safeDelegateCall(sfcProxy, sfc, 'currentEpoch');
if (result.success) {
  console.log('Current epoch call succeeded');
}
```

### Batch Testing

```typescript
// Test multiple functions at once
const calls = [
  sfcInterface.encodeFunctionData('currentEpoch'),
  sfcInterface.encodeFunctionData('totalSupply'),
  sfcInterface.encodeFunctionData('version')
];

const targets = Array(calls.length).fill(sfcAddress);
const [results, returnData] = await proxy.batchDelegateCall(targets, calls);

// Analyze results
results.forEach((success, index) => {
  console.log(`Call ${index}: ${success ? 'SUCCESS' : 'FAILED'}`);
});
```

## Fuzz Testing Strategies

### 1. Random Function Selector Testing

Test the SFC contract's resilience to invalid function calls:

```typescript
fc.hexaString({ minLength: 8, maxLength: 8 }) // 4-byte selectors
```

### 2. Random Parameter Testing

Test functions with random parameters:

```typescript
fc.record({
  selector: fc.constant('0x12345678'), // Known function selector
  params: fc.array(fc.bigInt(), { maxLength: 10 })
})
```

### 3. State Transition Testing

Test sequences of state-changing operations:

```typescript
fc.array(
  fc.record({
    functionName: fc.constantFrom('createValidator', 'delegate', 'undelegate'),
    params: fc.array(fc.bigInt())
  })
)
```

### 4. Edge Case Testing

Test boundary conditions and edge cases:

```typescript
fc.record({
  amount: fc.oneof(
    fc.constant(0n),           // Zero amount
    fc.constant(1n),           // Minimum amount  
    fc.constant(2n ** 256n - 1n) // Maximum uint256
  ),
  validatorId: fc.nat()
})
```

## Testing Invariants

### Proxy Invariants

1. **State Isolation**: Proxy state should never be affected by delegate calls
2. **Implementation Consistency**: Implementation address should only change via `updateImplementation`
3. **Access Control**: Only owner can update implementation

```typescript
// Example invariant test
expect(await proxy.getImplementation()).to.equal(expectedImplementation);
expect(await proxy.owner()).to.equal(expectedOwner);
expect(await proxy.isInitialized()).to.be.true;
```

### SFC Invariants

1. **Total Supply Conservation**: Total staked amount should equal sum of individual stakes
2. **Validator Consistency**: Validator data should remain consistent across operations
3. **Epoch Progression**: Epochs should only move forward

## Contract Address Management

The fuzz testing system uses a JSON-based address management system for consistent contract references across all tests.

### Address Configuration

Contract addresses are stored in `test/contract-addresses.json`:

```json
{
  "sfc": "0xfc00face00000000000000000000000000000000",
  "nodeDriver": "0xd100a01e00000000000000000000000000000000",
  "nodeDriverAuth": "0xd100ae0000000000000000000000000000000000",
  "evmWriter": "0xd100ec0000000000000000000000000000000000",
  "constants": "0x6CA548f6DF5B540E72262E935b6Fe3e72cDd68C9",
  "sfcProxy": "0x2a57261F79009f35B9b2d4C146471f47BaEf3f77"
}
```

### Automatic Deployment

If contracts are not available at the stored addresses, the system will:

1. Deploy fresh SFC implementation contracts
2. Deploy a new SFCDelegateCallProxy
3. Update the JSON file with new addresses
4. Use the new addresses for all subsequent tests

This ensures all tests use consistent addresses and can recover from deployment issues automatically.

## Test Structure

The fuzz testing system consists of several test suites:

### Comprehensive Proxy Tests
- **File**: `test/comprehensive_sfc_fuzz.ts`
- **Purpose**: Full SFC function coverage through proxy delegate calls
- **Features**: 33+ SFC functions tested, random parameters, boundary testing
- **Coverage**: 100% success rate with proxy-only testing

### Invariant Tests  
- **File**: `test/invariant/fuzz_CM.ts`
- **Purpose**: Constants Manager parameter validation and owner restrictions
- **Features**: Property-based testing of configuration updates

- **File**: `test/invariant/fuzz_get_methods_SFC.ts` 
- **Purpose**: SFC getter method validation and return type verification
- **Features**: State consistency checks, data type validation

- **File**: `test/invariant/fuzz_state_changing_SFC.ts`
- **Purpose**: State-modifying operation testing with proper preconditions
- **Features**: Balance changes, stake modifications, validator operations

- **File**: `test/invariant/sfc_invariants.ts`
- **Purpose**: System-wide invariant preservation across operation sequences
- **Features**: Multi-step operation sequences, invariant verification

## Running the Tests

### Install Dependencies

```bash
npm install
```

### Run Comprehensive Proxy-Based Fuzz Tests

```bash
npx hardhat test test/comprehensive_sfc_fuzz.ts
```

### Run Invariant Fuzz Tests

```bash
# Run all invariant tests
npx hardhat test test/invariant/

# Run specific invariant tests
npx hardhat test test/invariant/fuzz_CM.ts
npx hardhat test test/invariant/fuzz_get_methods_SFC.ts  
npx hardhat test test/invariant/fuzz_state_changing_SFC.ts
npx hardhat test test/invariant/sfc_invariants.ts
```

### Run All Fuzz Tests

```bash
npx hardhat test test/comprehensive_sfc_fuzz.ts test/invariant/
```

## Configuration

### Adjusting Fuzz Parameters

Modify test parameters in the fuzz test files:

```typescript
{ numRuns: 100, verbose: true } // Run 100 iterations with verbose output
```

### Custom Test Data Generators

Create domain-specific generators:

```typescript
// Generator for valid validator IDs
const validatorIdArb = fc.integer({ min: 1, max: 1000 });

// Generator for realistic stake amounts  
const stakeAmountArb = fc.bigInt({ min: 1n, max: 1000000n * 10n ** 18n });
```

## Best Practices

### 1. Isolate Test Scenarios

- Use separate contracts for different test scenarios
- Reset state between test runs when needed
- Use fixtures for consistent initial state

### 2. Monitor Gas Usage

- Track gas consumption during fuzz testing
- Identify gas-intensive operations
- Test gas limit edge cases

### 3. Log Important Events

- Monitor emitted events during testing
- Verify event parameters match expected values
- Use events to track state changes

### 4. Handle Errors Gracefully

- Distinguish between expected and unexpected errors
- Log error details for analysis
- Continue testing after recoverable errors

## Troubleshooting

### Common Issues

1. **Out of Gas**: Increase gas limit or reduce test complexity
2. **Revert Loops**: Add proper error handling in test code
3. **State Corruption**: Verify proxy isolation is working correctly

### Debugging Tips

- Use `verbose: true` in fuzz test configuration
- Add console.log statements in test code
- Run smaller test batches to isolate issues
- Check contract events for unexpected behavior

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Fuzz Tests
  run: |
    npx hardhat test test/comprehensive_sfc_fuzz.ts
    npx hardhat test test/invariant/fuzz_*.ts
    npx hardhat test test/invariant/sfc_invariants.ts --grep "should maintain"
```

### Test Coverage

Monitor test coverage for fuzz tests:

```bash
npx hardhat coverage --testfiles "test/comprehensive_sfc_fuzz.ts" --testfiles "test/invariant/fuzz_*.ts"
```

This proxy-based approach enables comprehensive fuzz testing of the SFC contract while maintaining safety and providing detailed analysis capabilities.