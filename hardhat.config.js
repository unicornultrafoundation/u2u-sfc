require('@nomicfoundation/hardhat-toolbox');
require('@nomiclabs/hardhat-truffle5');
require('hardhat-contract-sizer');
require('dotenv').config();

const { PRIVATE_KEY } = process.env;
const { API_KEY } = process.env;

module.exports = {
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
        },
        localhost: {
            url: 'http://127.0.0.1:8545',
        },
        mainnet: {
            url: 'https://rpc-mainnet.uniultra.xyz',
            chainId: 39,
        },
        testnet: {
            url: 'https://rpc-nebulas-testnet.uniultra.xyz',
            chainId: 2484,
            accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
        },
    },
    etherscan: {
        apiKey: {
            u2uTestnet: API_KEY,
        },
    },
    contractSizer: {
        runOnCompile: true,
    },
    mocha: {},
    abiExporter: {
        path: './build/contracts',
        clear: true,
        flat: true,
        spacing: 2,
    },
    solidity: {
        version: '0.5.17',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    gasReporter: {
        currency: 'USD',
        enabled: false,
        gasPrice: 50,
    },
};
