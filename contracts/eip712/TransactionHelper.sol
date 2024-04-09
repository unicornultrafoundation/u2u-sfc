// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import "../openzeppelin/token/ERC20/IERC20.sol";
import "../openzeppelin/token/ERC20/utils/SafeERC20.sol";

import "./IPaymasterFlow.sol";

/// @dev The type id of U2U's EIP-712-signed transaction.
uint8 constant EIP_712_TX_TYPE = 0x71;

/// @dev The type id of legacy transactions.
uint8 constant LEGACY_TX_TYPE = 0x0;
/// @dev The type id of legacy transactions.
uint8 constant EIP_2930_TX_TYPE = 0x01;
/// @dev The type id of EIP1559 transactions.
uint8 constant EIP_1559_TX_TYPE = 0x02;

address constant U2U_TOKEN = address(0xA99cf32e9aAa700f9E881BA9BF2C57A211ae94df);

/// @notice Structure used to represent a U2U transaction.
struct Transaction {
    // The type of the transaction.
    uint256 txType;
    // The caller.
    uint256 from;
    // The callee.
    uint256 to;
    // The gasLimit to pass with the transaction.
    // It has the same meaning as Ethereum's gasLimit.
    uint256 gasLimit;
    // The maximum amount of gas the user is willing to pay for a byte of pubdata.
    uint256 gasPerPubdataByteLimit;
    // The maximum fee per gas that the user is willing to pay.
    // It is akin to EIP1559's maxFeePerGas.
    uint256 maxFeePerGas;
    // The maximum priority fee per gas that the user is willing to pay.
    // It is akin to EIP1559's maxPriorityFeePerGas.
    uint256 maxPriorityFeePerGas;
    // The transaction's paymaster. If there is no paymaster, it is equal to 0.
    uint256 paymaster;
    // The nonce of the transaction.
    uint256 nonce;
    // The value to pass with the transaction.
    uint256 value;
    // In the future, we might want to add some
    // new fields to the struct. The `txData` struct
    // is to be passed to account and any changes to its structure
    // would mean a breaking change to these accounts. In order to prevent this,
    // we should keep some fields as "reserved".
    // It is also recommended that their length is fixed, since
    // it would allow easier proof integration (in case we will need
    // some special circuit for preprocessing transactions).
    uint256[4] reserved;
    // The transaction's calldata.
    bytes data;
    // The signature of the transaction.
    bytes signature;
    // The input to the paymaster.
    bytes paymasterInput;
}

/**
 * @author Matter Labs
 * @custom:security-contact security@matterlabs.dev
 * @notice Library is used to help custom accounts to work with common methods for the Transaction type.
 */
library TransactionHelper {
    using SafeERC20 for IERC20;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId)");

    bytes32 constant EIP712_TRANSACTION_TYPE_HASH =
        keccak256(
            "Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes paymasterInput)"
        );

    /// @notice Whether the token is Ethereum.
    /// @param _addr The address of the token
    /// @return `true` or `false` based on whether the token is Ether.
    /// @dev This method assumes that address is Ether either if the address is 0 (for convenience)
    /// or if the address is the address of the L2EthToken system contract.
    function isU2UToken(uint256 _addr) internal pure returns (bool) {
        return _addr == uint256(uint160(address(U2U_TOKEN))) || _addr == 0;
    }

    /// @notice Calculate the suggested signed hash of the transaction,
    /// i.e. the hash that is signed by EOAs and is recommended to be signed by other accounts.
    function encodeHash(Transaction calldata _transaction) internal view returns (bytes32 resultHash) {
        if (_transaction.txType == EIP_712_TX_TYPE) {
            resultHash = _encodeHashEIP712Transaction(_transaction);
        } else {
            // Currently no other transaction types are supported.
            // Any new transaction types will be processed in a similar manner.
            revert("Encoding unsupported tx");
        }
    }

    /// @notice Encode hash of the U2U native transaction type.
    /// @return keccak256 hash of the EIP-712 encoded representation of transaction
    function _encodeHashEIP712Transaction(Transaction calldata _transaction) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                EIP712_TRANSACTION_TYPE_HASH,
                _transaction.txType,
                _transaction.from,
                _transaction.to,
                _transaction.gasLimit,
                _transaction.gasPerPubdataByteLimit,
                _transaction.maxFeePerGas,
                _transaction.maxPriorityFeePerGas,
                _transaction.paymaster,
                _transaction.nonce,
                _transaction.value,
                keccak256(_transaction.data),
                keccak256(_transaction.paymasterInput)
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256("U2U"), keccak256("2"), block.chainid)
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// @notice Processes the common paymaster flows, e.g. setting proper allowance
    /// for tokens, etc. For more information on the expected behavior, check out
    /// the "Paymaster flows" section in the documentation.
    function processPaymasterInput(Transaction calldata _transaction) internal {
        require(_transaction.paymasterInput.length >= 4, "The standard paymaster input must be at least 4 bytes long");

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            require(
                _transaction.paymasterInput.length >= 68,
                "The approvalBased paymaster input must be at least 68 bytes long"
            );

            // While the actual data consists of address, uint256 and bytes data,
            // the data is needed only for the paymaster, so we ignore it here for the sake of optimization
            (address token, uint256 minAllowance) = abi.decode(_transaction.paymasterInput[4:68], (address, uint256));
            address paymaster = address(uint160(_transaction.paymaster));

            uint256 currentAllowance = IERC20(token).allowance(address(this), paymaster);
            if (currentAllowance < minAllowance) {
                // Some tokens, e.g. USDT require that the allowance is firsty set to zero
                // and only then updated to the new value.

                IERC20(token).safeApprove(paymaster, 0);
                IERC20(token).safeApprove(paymaster, minAllowance);
            }
        } else if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            // Do nothing. general(bytes) paymaster flow means that the paymaster must interpret these bytes on his own.
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    // Returns the balance required to process the transaction.
    function totalRequiredBalance(Transaction calldata _transaction) internal pure returns (uint256 requiredBalance) {
        if (address(uint160(_transaction.paymaster)) != address(0)) {
            // Paymaster pays for the fee
            requiredBalance = _transaction.value;
        } else {
            // The user should have enough balance for both the fee and the value of the transaction
            requiredBalance = _transaction.maxFeePerGas * _transaction.gasLimit + _transaction.value;
        }
    }
}
