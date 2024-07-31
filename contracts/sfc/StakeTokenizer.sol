pragma solidity ^0.5.0;


import "./SFC.sol";
import "../erc20/base/ERC20Burnable.sol";
import "../erc20/base/ERC20Mintable.sol";
import "../common/Initializable.sol";

contract Spacer {
    address private _owner;
}

contract StakeTokenizer is Spacer, Initializable {
    SFC internal sfc;

    mapping(address => mapping(uint256 => uint256)) public outstandingSU2U;

    address public sU2UTokenAddress;

    function initialize(address payable _sfc, address _sU2UTokenAddress) public initializer {
        sfc = SFC(_sfc);
        sU2UTokenAddress = _sU2UTokenAddress;
    }

    function redeemSU2U(uint256 validatorID, uint256 amount) external {
        require(outstandingSU2U[msg.sender][validatorID] >= amount, "low outstanding sU2U balance");
        require(IERC20(sU2UTokenAddress).allowance(msg.sender, address(this)) >= amount, "insufficient allowance");
        outstandingSU2U[msg.sender][validatorID] -= amount;

        // It's important that we burn after updating outstandingSU2U (protection against Re-Entrancy)
        ERC20Burnable(sU2UTokenAddress).burnFrom(msg.sender, amount);
    }

    function allowedToWithdrawStake(address sender, uint256 validatorID) public view returns(bool) {
        return outstandingSU2U[sender][validatorID] == 0;
    }
}
