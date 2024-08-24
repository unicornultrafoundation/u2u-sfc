pragma solidity ^0.5.0;


import "./NodeDriver.sol";
import "./SFC.sol";

contract Updater {
    address public sfcFrom;
    address public sfcLib;
    address public sfcConsts;
    address public owner;

    constructor(address _sfcFrom, address _sfcLib, address _sfcConsts, address _owner) public {
        sfcFrom = _sfcFrom;
        sfcLib = _sfcLib;
        owner = _owner;
        sfcConsts = _sfcConsts;
        address payable sfcTo = 0xFC00FACE00000000000000000000000000000000;
        require(sfcFrom != address(0) && sfcLib != address(0) && sfcConsts != address(0) && owner != address(0), "0 address");
        require(Version(sfcTo).version() == "306", "SFC already updated");
        require(Version(sfcFrom).version() == "307", "wrong SFC version");
    }

    function execute() external {
        address payable sfcTo = 0xFC00FACE00000000000000000000000000000000;

        NodeDriverAuth nodeAuth = NodeDriverAuth(0xD100ae0000000000000000000000000000000000);
        nodeAuth.upgradeCode(sfcTo, sfcFrom);

        SFCI(sfcTo).updateConstsAddress(sfcConsts);
        SFC(sfcTo).updateLibAddress(sfcLib);


        Ownable(sfcTo).transferOwnership(owner);
        nodeAuth.transferOwnership(owner);
    }
}
