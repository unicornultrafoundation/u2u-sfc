import "@openzeppelin/hardhat-upgrades"
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import { HardhatUserConfig } from "hardhat/types";

const PRIVATE_KEYS = [
  "0x163f5f0f9a621d72fedd85ffca3d08d131ab4e812181e0d30ffd1c885d20aac7",
  "0x3144c0aa4ced56dc15c79b045bc5559a5ac9363d98db6df321fe3847a103740f",
  "0x04a531f967898df5dbe223b67989b248e23c1c356a3f6717775cccb7fe53482c",
  "0x00ca81d4fe11c23fae8b5e5b06f9fe952c99ca46abaec8bda70a678cd0314dde",
  "0x532d9b2ce282fad94efefcf076fdfbe5befe558b145f4cc97f953bcabf087aeb",
  "0x6e50dbd3e81b22424cb230133b87bc9ef0f17c584a2a5dc4b212d2b83b5ee084",
  "0x2215aaee06a2d64ca32b201e1fb9d1e3c7a25d45a6d8b0de6300ba3a20e42ef5",
  "0x1cd6fdfc633c0fa73bd306c46eecd23096365b44ab75f0e6fa04dc2adbea9583",
  "0x2fc91d5829f44650c32ba92c8b29d511511446b91badf03b1fd0f808b91a4b5b",
  "0x6aeeb7f09e757baa9d3935a042c3d0d46a2eda19e9b676283dce4eaf32e29dc9",
  "0x7d51a817ee07c3f28581c47a5072142193337fdca4d7911e58c5af2d03895d1a",
  "0x59963733b8a6fb1c6eeb1ce51c7e6046e652a9bcacd4cbaa3f6f26dafe7f79f7",
  "0x4cf757812428b0764a871e94b02ba026a5d3738e69f7d1d4f9f93b43ed00e820",
]

const LOCAL_URL = process.env.ETH_NODE_URL || 'http://localhost:8545';
const REMOTE_URL = process.env.ETH_NODE_URL || ""

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    local: {
      url: LOCAL_URL,
      accounts: PRIVATE_KEYS,
      gas: 1000_000_000
    },
    ubuntu: {
      url: REMOTE_URL,
      accounts: PRIVATE_KEYS
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: !!process.env.REPORT_GAS,
    gasPrice: 50,
  },
  contractSizer: {
    runOnCompile: true,
  },
  solidity: {
    version: '0.5.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};

export default config;
