import { Multicall as Multicall3 } from "ethereum-multicall";
import Multicall from "@dopex-io/web3-multicall";

import { Dispatcher } from "flux";
import EventEmitter from "events";

import { ACTIONS, CONTRACTS } from "./constants/constants";

import {
  injected,
  walletconnect,
  walletlink,
  network,
} from "./connectors/connectors";

import Web3 from "web3";
import type { Signer } from "ethers";

type EthWindow = Window &
  typeof globalThis & {
    ethereum?: any;
  };

class Store {
  dispatcher: Dispatcher<any>;
  emitter: EventEmitter;
  store: {
    account: null | { address: `0x${string}` };
    chainInvalid: boolean;
    web3context: null | { library: { provider: any } };
    tokens: any[];
    connectorsByName: {
      MetaMask: typeof injected;
      TrustWallet: typeof injected;
      WalletConnect: typeof walletconnect;
      WalletLink: typeof walletlink;
    };
    currentBlock: number;
    gasPrices: {
      standard: number;
      fast: number;
      instant: number;
    };
    gasSpeed: string;
    wagmiSigner: null | Signer;
  };

  constructor(dispatcher: Dispatcher<any>, emitter: EventEmitter) {
    this.dispatcher = dispatcher;
    this.emitter = emitter;

    this.store = {
      account: null,
      chainInvalid: false,
      web3context: null,
      tokens: [],
      connectorsByName: {
        MetaMask: injected,
        TrustWallet: injected,
        WalletConnect: walletconnect,
        WalletLink: walletlink,
      } as const,
      currentBlock: 12906197,
      gasPrices: {
        standard: 90,
        fast: 100,
        instant: 130,
      },
      gasSpeed: "fast",
      wagmiSigner: null,
    };

    dispatcher.register(
      function (this: Store, payload: { type: string }) {
        switch (payload.type) {
          case ACTIONS.CONFIGURE:
            this.configure();
            break;
          default: {
          }
        }
      }.bind(this)
    );
  }

  getStore = <K extends keyof Store["store"]>(index: K) => {
    return this.store[index];
  };

  setStore(obj: { [key: string]: any }) {
    this.store = { ...this.store, ...obj };
    return this.emitter.emit(ACTIONS.STORE_UPDATED);
  }

  configure = async () => {
    this.emitter.emit(ACTIONS.ACCOUNT_CONFIGURED);
    this.emitter.emit(ACTIONS.CONFIGURE_RETURNED);
  };

  /**
   * @returns gas price in gwei
   */
  getGasPrice = async () => {
    try {
      const web3 = await this.getWeb3Provider();
      if (!web3) throw new Error("Couldnt get web3");
      const gasPrice = await web3.eth.getGasPrice();
      const gasPriceInGwei = web3.utils.fromWei(gasPrice, "gwei");
      return gasPriceInGwei;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  getWeb3Provider = async () => {
    let web3context = this.getStore("web3context");
    let provider = null;

    if (!web3context) {
      provider = network.getProvider();
    } else {
      provider = web3context.library.provider;
    }

    if (!provider) {
      return null;
    }
    return new Web3(provider);
  };

  getEthersSigner = () => {
    return this.getStore("wagmiSigner");
  };

  getMulticall = async () => {
    const web3 = await this.getWeb3Provider();
    if (!web3) throw new Error("Couldn't get multicall");
    const multicall = new Multicall({
      multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
      provider: web3.currentProvider,
    });
    return multicall;
  };

  getMulticall3 = async (tryAggregate: boolean) => {
    const web3 = await this.getWeb3Provider();
    if (!web3) throw new Error("Couldn't get web3");
    const multicall = new Multicall3({
      web3Instance: web3,
      tryAggregate,
      multicallCustomContractAddress: CONTRACTS.MULTICALL_ADDRESS,
    });
    return multicall;
  };

  getGasPriceEIP1559 = async () => {
    const web3 = await this.getWeb3Provider();
    if (!web3) throw new Error("Couldn't get web3");
    const blocksBack = 10;
    const feeHistory = await web3.eth.getFeeHistory(blocksBack, "pending", [
      10,
    ]);
    const blocks = this._formatFeeHistory(feeHistory, false, blocksBack);

    const firstPercentialPriorityFees = blocks.map(
      (b) => b.priorityFeePerGas[0]
    );
    const sum = firstPercentialPriorityFees.reduce((a, v) => a + v);
    const priorityFeePerGasEstimate = Math.round(
      sum / firstPercentialPriorityFees.length
    );
    let priorityFee = priorityFeePerGasEstimate;
    if (priorityFee === 0) {
      priorityFee = 100_000_000;
    }
    const block = await web3.eth.getBlock("pending");
    return [Number(block.baseFeePerGas) + priorityFee, priorityFee];
  };

  _formatFeeHistory(
    result: Awaited<ReturnType<Web3["eth"]["getFeeHistory"]>>,
    includePending: boolean,
    historicalBlocks: number
  ) {
    let blockNum = result.oldestBlock;
    let index = 0;
    const blocks: {
      number: number | "pending";
      baseFeePerGas: number;
      gasUsedRatio: number;
      priorityFeePerGas: number[];
    }[] = [];
    while (blockNum < result.oldestBlock + historicalBlocks) {
      blocks.push({
        number: blockNum,
        baseFeePerGas: Number(result.baseFeePerGas[index]),
        gasUsedRatio: Number(result.gasUsedRatio[index]),
        priorityFeePerGas: result.reward[index].map((x) => Number(x)),
      });
      blockNum += 1;
      index += 1;
    }
    if (includePending) {
      blocks.push({
        number: "pending",
        baseFeePerGas: Number(result.baseFeePerGas[historicalBlocks]),
        gasUsedRatio: NaN,
        priorityFeePerGas: [],
      });
    }
    return blocks;
  }
}

export default Store;
