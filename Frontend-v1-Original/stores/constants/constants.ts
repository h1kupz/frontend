import BigNumber from "bignumber.js";

import * as contractsTestnet from "./contractsGoerli";
import * as contractsCanto from "./contractsCanto";
import * as contracts from "./contracts";
import * as actions from "./actions";

let network: "7700" | "42161" | "421613" = "7700";

if (process.env.NEXT_PUBLIC_CHAINID === "42161") {
  network = "42161";
} else if (process.env.NEXT_PUBLIC_CHAINID === "421613") {
  network = "421613";
}

const config = {
  "7700": {
    scan: "https://tuber.build/",
    contracts: contractsCanto,
    nativeETH: {
      address: contractsCanto.CANTO_ADDRESS,
      decimals: contractsCanto.CANTO_DECIMALS,
      logoURI: contractsCanto.CANTO_LOGO,
      name: contractsCanto.CANTO_NAME,
      symbol: contractsCanto.CANTO_SYMBOL,
      chainId: 7700,
    },
    wNativeAddress: contractsCanto.WCANTO_ADDRESS,
    wNativeABI: contractsCanto.WCANTO_ABI,
  },
  "421613": {
    scan: "https://goerli.arbiscan.io/",
    contracts: contractsTestnet,
    nativeETH: {
      address: contractsTestnet.ETH_ADDRESS,
      decimals: contractsTestnet.ETH_DECIMALS,
      logoURI: contractsTestnet.ETH_LOGO,
      name: contractsTestnet.ETH_NAME,
      symbol: contractsTestnet.ETH_SYMBOL,
      chainId: 421613,
    },
    wNativeAddress: contractsTestnet.WETH_ADDRESS,
    wNativeABI: contractsTestnet.WETH_ABI,
  },
  "42161": {
    scan: "https://arbiscan.io/",
    contracts: contracts,
    nativeETH: {
      address: contracts.ETH_ADDRESS,
      decimals: contracts.ETH_DECIMALS,
      logoURI: contracts.ETH_LOGO,
      name: contracts.ETH_NAME,
      symbol: contracts.ETH_SYMBOL,
      chainId: 42161,
    },
    wNativeAddress: contractsTestnet.WETH_ADDRESS,
    wNativeABI: contractsTestnet.WETH_ABI,
  },
};

export const ETHERSCAN_URL = config[network].scan;

export const CONTRACTS = config[network].contracts;
export const ACTIONS = actions;

export const MAX_UINT256 = new BigNumber(2).pow(256).minus(1).toFixed(0);
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const NATIVE_TOKEN = config[network].nativeETH;
export const W_NATIVE_ADDRESS = config[network].wNativeAddress;
export const W_NATIVE_ABI = config[network].wNativeABI;

export const PAIR_DECIMALS = 18;
