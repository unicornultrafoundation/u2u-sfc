pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../sfc/SFCI.sol";

/**
 * @title SFCDelegateCallProxy
 * @dev A proxy contract that forwards all calls to the SFC implementation using delegatecall
 * This contract is specifically designed for fuzz testing to ensure proper delegation behavior
 */
contract SFCDelegateCallProxy {
    address public implementation;
    address public owner;
    
    event ImplementationUpdated(address indexed oldImplementation, address indexed newImplementation);
    event DelegateCallExecuted(address indexed target, bool success, bytes data);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor(address _implementation) public {
        require(_implementation != address(0), "Implementation cannot be zero address");
        implementation = _implementation;
        owner = msg.sender;
    }
    
    /**
     * @dev Updates the implementation address
     * @param _newImplementation The new SFC implementation address
     */
    function updateImplementation(address _newImplementation) external onlyOwner {
        require(_newImplementation != address(0), "Implementation cannot be zero address");
        address oldImplementation = implementation;
        implementation = _newImplementation;
        emit ImplementationUpdated(oldImplementation, _newImplementation);
    }
    
    /**
     * @dev Fallback function that delegates all calls to the implementation
     */
    function() external payable {
        _delegate(implementation);
    }
    
    /**
     * @dev Internal function to perform delegatecall to implementation
     * @param _implementation The address to delegate to
     */
    function _delegate(address _implementation) internal {
        assembly {
            // Copy msg.data to memory
            calldatacopy(0, 0, calldatasize)
            
            // Perform delegatecall
            let result := delegatecall(gas, _implementation, 0, calldatasize, 0, 0)
            
            // Copy return data
            returndatacopy(0, 0, returndatasize)
            
            // Return or revert based on the call result
            switch result
            case 0 { revert(0, returndatasize) }
            default { return(0, returndatasize) }
        }
    }
    
    /**
     * @dev Explicit delegate call for fuzz testing with result tracking
     * @param _target Target contract address
     * @param _data Call data to send
     * @return success Whether the call succeeded
     * @return returnData The return data from the call
     */
    function testDelegateCall(address _target, bytes memory _data) 
        public 
        payable 
        returns (bool success, bytes memory returnData) 
    {
        assembly {
            // Perform delegatecall
            success := delegatecall(gas, _target, add(_data, 0x20), mload(_data), 0, 0)
            
            // Allocate memory for return data
            let size := returndatasize
            returnData := mload(0x40)
            mstore(0x40, add(returnData, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(returnData, size)
            returndatacopy(add(returnData, 0x20), 0, size)
        }
        
        emit DelegateCallExecuted(_target, success, _data);
    }
    
    /**
     * @dev Batch delegate calls for efficient fuzz testing
     * @param _targets Array of target addresses  
     * @param _calls Array of call data
     * @return results Array of call results
     */
    function batchDelegateCall(address[] memory _targets, bytes[] memory _calls)
        public
        payable
        returns (bool[] memory results, bytes[] memory returnData)
    {
        require(_targets.length == _calls.length, "Arrays length mismatch");
        
        results = new bool[](_targets.length);
        returnData = new bytes[](_targets.length);
        
        for (uint256 i = 0; i < _targets.length; i++) {
            (results[i], returnData[i]) = testDelegateCall(_targets[i], _calls[i]);
        }
    }
    
    /**
     * @dev Get the current implementation address
     * @return The implementation address
     */
    function getImplementation() external view returns (address) {
        return implementation;
    }
    
    /**
     * @dev Check if the proxy is properly initialized
     * @return True if implementation is set and not zero address
     */
    function isInitialized() external view returns (bool) {
        return implementation != address(0);
    }
}