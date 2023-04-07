import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import type { Contract } from "web3-eth-contract";
import type { AbiItem } from "web3-utils";
import BigNumber from "bignumber.js";
import type Web3 from "web3";
import { TransactionReceipt } from "@ethersproject/providers";

import { Dispatcher } from "flux";
import EventEmitter from "events";

import stores from ".";
import {
  formatCurrency,
  formatMooPairSymbol,
  formatMooTokenSymbol,
} from "../utils/utils";
import {
  ACTIONS,
  CONTRACTS,
  MAX_UINT256,
  ZERO_ADDRESS,
  NATIVE_TOKEN,
  W_NATIVE_ADDRESS,
  PAIR_DECIMALS,
} from "./constants/constants";

import tokenlistArb from "../mainnet-arb-token-list.json";
import tokenlistCan from "../mainnet-canto-token-list.json";
import {
  BaseAsset,
  Pair,
  RouteAsset,
  VeToken,
  Vote,
  VestNFT,
  CantoContracts,
  GovToken,
  Votes,
  QuoteSwapResponse,
  Bribe,
  VeDistReward,
  ITransaction,
  Gauge,
  hasGauge,
  TransactionStatus,
} from "./types/types";
import {
  FLOW_CONVERTOR_ADDRESS,
  FLOW_V1_ADDRESS,
} from "./constants/contractsCanto";

const isArbitrum = process.env.NEXT_PUBLIC_CHAINID === "42161";

const tokenlist = isArbitrum ? tokenlistArb : tokenlistCan;
class Store {
  dispatcher: Dispatcher<any>;
  emitter: EventEmitter;
  store: {
    baseAssets: BaseAsset[];
    swapAssets: BaseAsset[];
    routeAssets: RouteAsset[];
    govToken: GovToken | null;
    veToken: VeToken | null;
    pairs: Pair[];
    vestNFTs: VestNFT[];
    rewards: {
      bribes: Gauge[];
      rewards: Gauge[];
      veDist: VeDistReward[];
    };
    updateDate: number;
    tokenPrices: Map<string, number>;
    tvl: number;
    circulatingSupply: number;
    marketCap: number;
    u_domain: string | undefined;
  };

  constructor(dispatcher: Dispatcher<any>, emitter: EventEmitter) {
    this.dispatcher = dispatcher;
    this.emitter = emitter;

    this.store = {
      baseAssets: [],
      swapAssets: [],
      routeAssets: [],
      govToken: null,
      veToken: null,
      pairs: [],
      vestNFTs: [],
      rewards: {
        bribes: [],
        rewards: [],
        veDist: [],
      },
      updateDate: 0,
      tokenPrices: new Map(),
      tvl: 0,
      circulatingSupply: 0,
      marketCap: 0,
      u_domain: undefined,
    };

    dispatcher.register(
      function (this: Store, payload: { type: string; content: any }) {
        console.log("<< Payload of dispatched event", payload);
        switch (payload.type) {
          case ACTIONS.CONFIGURE_SS:
            this.configure();
            break;
          case ACTIONS.GET_BALANCES:
            this.getBalances();
            break;
          case ACTIONS.SEARCH_ASSET:
            this.searchBaseAsset(payload);
            break;

          case ACTIONS.UPDATED:
            break;

          // LIQUIDITY
          case ACTIONS.CREATE_PAIR_AND_STAKE:
            this.createPairStake(payload);
            break;
          case ACTIONS.CREATE_PAIR_AND_DEPOSIT:
            this.createPairDeposit(payload);
            break;
          case ACTIONS.ADD_LIQUIDITY:
            this.addLiquidity(payload);
            break;
          case ACTIONS.STAKE_LIQUIDITY:
            this.stakeLiquidity(payload);
            break;
          case ACTIONS.ADD_LIQUIDITY_AND_STAKE:
            this.addLiquidityAndStake(payload);
            break;
          case ACTIONS.QUOTE_ADD_LIQUIDITY:
            this.quoteAddLiquidity(payload);
            break;
          case ACTIONS.GET_LIQUIDITY_BALANCES:
            this.getLiquidityBalances(payload);
            break;
          case ACTIONS.REMOVE_LIQUIDITY:
            this.removeLiquidity(payload);
            break;
          case ACTIONS.UNSTAKE_AND_REMOVE_LIQUIDITY:
            this.unstakeAndRemoveLiquidity(payload);
            break;
          case ACTIONS.QUOTE_REMOVE_LIQUIDITY:
            this.quoteRemoveLiquidity(payload);
            break;
          case ACTIONS.UNSTAKE_LIQUIDITY:
            this.unstakeLiquidity(payload);
            break;
          case ACTIONS.CREATE_GAUGE:
            this.createGauge(payload);
            break;

          // SWAP
          case ACTIONS.QUOTE_SWAP:
            this.quoteSwap(payload);
            break;
          case ACTIONS.SWAP:
            this.swap(payload);
            break;

          // WRAP / UNWRAP:
          case ACTIONS.WRAP_UNWRAP:
            this.wrapOrUnwrap(payload);
            break;

          // REDEEM
          case ACTIONS.REDEEM:
            this.redeem(payload);
            break;

          // VESTING
          case ACTIONS.GET_VEST_NFTS:
            this.getVestNFTs();
            break;
          case ACTIONS.CREATE_VEST:
            this.createVest(payload);
            break;
          case ACTIONS.INCREASE_VEST_AMOUNT:
            this.increaseVestAmount(payload);
            break;
          case ACTIONS.INCREASE_VEST_DURATION:
            this.increaseVestDuration(payload);
            break;
          case ACTIONS.RESET_VEST:
            this.resetVest(payload);
            break;
          case ACTIONS.WITHDRAW_VEST:
            this.withdrawVest(payload);
            break;

          //VOTE
          case ACTIONS.VOTE:
            this.vote(payload);
            break;
          case ACTIONS.GET_VEST_VOTES:
            this.getVestVotes(payload);
            break;
          case ACTIONS.CREATE_BRIBE:
            this.createBribe(payload);
            break;
          case ACTIONS.GET_VEST_BALANCES:
            this.getVestBalances(payload);
            break;

          //REWARDS
          case ACTIONS.GET_REWARD_BALANCES:
            this.getRewardBalances(payload);
            break;
          case ACTIONS.CLAIM_BRIBE:
            this.claimBribes(payload);
            break;

          case ACTIONS.CLAIM_REWARD:
            this.claimRewards(payload);
            break;
          case ACTIONS.CLAIM_VE_DIST:
            this.claimVeDist(payload);
            break;
          case ACTIONS.CLAIM_ALL_REWARDS:
            this.claimAllRewards(payload);
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

  setStore = (obj: { [key: string]: any }) => {
    this.store = { ...this.store, ...obj };
    return this.emitter.emit(ACTIONS.STORE_UPDATED);
  };

  getNFTByID = async (id: string) => {
    try {
      const vestNFTs = this.getStore("vestNFTs");
      let theNFT = vestNFTs.filter((vestNFT) => {
        return vestNFT.id == id;
      });

      if (theNFT.length > 0) {
        return theNFT[0];
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        console.warn("veToken or govToken not found");
        return null;
      }

      const vestingContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const nftsLength = await vestingContract.methods
        .balanceOf(account.address)
        .call();
      const arr = Array.from({ length: parseInt(nftsLength) }, (v, i) => i);

      const nfts: VestNFT[] = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await vestingContract.methods
            .tokenOfOwnerByIndex(account.address, idx)
            .call();
          const locked = await vestingContract.methods
            .locked(tokenIndex)
            .call();
          const lockValue = await vestingContract.methods
            .balanceOfNFT(tokenIndex)
            .call();
          const voted = await this._checkNFTVotedEpoch(web3, tokenIndex);
          // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
          return {
            id: tokenIndex,
            lockEnds: locked.end,
            lockAmount: BigNumber(locked.amount)
              .div(10 ** govToken.decimals)
              .toFixed(govToken.decimals),
            lockValue: BigNumber(lockValue)
              .div(10 ** veToken.decimals)
              .toFixed(veToken.decimals),
            voted,
          };
        })
      );

      this.setStore({ vestNFTs: nfts });

      theNFT = nfts.filter((nft) => {
        return nft.id == id;
      });

      if (theNFT.length > 0) {
        return theNFT[0];
      }

      return null;
    } catch (ex) {
      console.log(ex);
      return null;
    }
  };

  _updateVestNFTByID = async (id: string) => {
    try {
      const vestNFTs = this.getStore("vestNFTs");
      let theNFT = vestNFTs.filter((vestNFT) => {
        return vestNFT.id == id;
      });

      if (theNFT.length == 0) {
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        console.warn("veToken or govToken not found");
        return null;
      }

      const vestingContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const locked = await vestingContract.methods.locked(id).call();
      const lockValue = await vestingContract.methods.balanceOfNFT(id).call();
      const voted = await this._checkNFTVotedEpoch(web3, id);

      const newVestNFTs: VestNFT[] = vestNFTs.map((nft) => {
        if (nft.id == id) {
          return {
            id: id,
            lockEnds: locked.end,
            lockAmount: BigNumber(locked.amount)
              .div(10 ** govToken.decimals)
              .toFixed(govToken.decimals),
            lockValue: BigNumber(lockValue)
              .div(10 ** veToken.decimals)
              .toFixed(veToken.decimals),
            voted,
          };
        }

        return nft;
      });

      this.setStore({ vestNFTs: newVestNFTs });
      this.emitter.emit(ACTIONS.UPDATED);
      return null;
    } catch (ex) {
      console.log(ex);
      return null;
    }
  };

  getPairByAddress = async (pairAddress: string) => {
    try {
      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const pairs = this.getStore("pairs");
      let thePair: any = pairs.filter((pair) => {
        return pair.address.toLowerCase() == pairAddress.toLowerCase();
      });

      if (thePair.length > 0) {
        const pc = new web3.eth.Contract(
          CONTRACTS.PAIR_ABI as AbiItem[],
          pairAddress
        );

        const [totalSupply, reserve0, reserve1, balanceOf] = await Promise.all([
          pc.methods.totalSupply().call(),
          pc.methods.reserve0().call(),
          pc.methods.reserve1().call(),
          pc.methods.balanceOf(account.address).call(),
        ]);

        const returnPair = thePair[0];
        returnPair.balance = BigNumber(balanceOf)
          .div(10 ** PAIR_DECIMALS)
          .toFixed(PAIR_DECIMALS);
        returnPair.totalSupply = BigNumber(totalSupply)
          .div(10 ** PAIR_DECIMALS)
          .toFixed(PAIR_DECIMALS);
        returnPair.reserve0 = BigNumber(reserve0)
          .div(10 ** returnPair.token0.decimals)
          .toFixed(parseInt(returnPair.token0.decimals));
        returnPair.reserve1 = BigNumber(reserve1)
          .div(10 ** returnPair.token1.decimals)
          .toFixed(parseInt(returnPair.token1.decimals));

        return returnPair;
      }

      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        pairAddress
      );
      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      const [totalWeight] = await Promise.all([
        gaugesContract.methods.totalWeight().call(),
      ]);

      const [
        token0,
        token1,
        totalSupply,
        symbol,
        reserve0,
        reserve1,
        decimals,
        balanceOf,
        stable,
        gaugeAddress,
        gaugeWeight,
      ] = await Promise.all([
        pairContract.methods.token0().call(),
        pairContract.methods.token1().call(),
        pairContract.methods.totalSupply().call(),
        pairContract.methods.symbol().call(),
        pairContract.methods.reserve0().call(),
        pairContract.methods.reserve1().call(),
        pairContract.methods.decimals().call(),
        pairContract.methods.balanceOf(account.address).call(),
        pairContract.methods.stable().call(),
        gaugesContract.methods.gauges(pairAddress).call(),
        gaugesContract.methods.weights(pairAddress).call(),
      ]);

      const token0Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        token0
      );
      const token1Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        token1
      );

      const [
        token0Symbol,
        token0Decimals,
        token0Balance,
        token1Symbol,
        token1Decimals,
        token1Balance,
      ] = await Promise.all([
        token0Contract.methods.symbol().call(),
        token0Contract.methods.decimals().call(),
        token0Contract.methods.balanceOf(account.address).call(),
        token1Contract.methods.symbol().call(),
        token1Contract.methods.decimals().call(),
        token1Contract.methods.balanceOf(account.address).call(),
      ]);

      thePair = {
        address: pairAddress,
        symbol: symbol,
        decimals: parseInt(decimals),
        stable,
        token0: {
          address: token0,
          symbol: token0Symbol,
          balance: BigNumber(token0Balance)
            .div(10 ** token0Decimals)
            .toFixed(parseInt(token0Decimals)),
          decimals: parseInt(token0Decimals),
        },
        token1: {
          address: token1,
          symbol: token1Symbol,
          balance: BigNumber(token1Balance)
            .div(10 ** token1Decimals)
            .toFixed(parseInt(token1Decimals)),
          decimals: parseInt(token1Decimals),
        },
        balance: BigNumber(balanceOf)
          .div(10 ** decimals)
          .toFixed(parseInt(decimals)),
        totalSupply: BigNumber(totalSupply)
          .div(10 ** decimals)
          .toFixed(parseInt(decimals)),
        reserve0: BigNumber(reserve0)
          .div(10 ** token0Decimals)
          .toFixed(parseInt(token0Decimals)),
        reserve1: BigNumber(reserve1)
          .div(10 ** token1Decimals)
          .toFixed(parseInt(token1Decimals)),
        tvl: 0,
      };

      if (gaugeAddress !== ZERO_ADDRESS) {
        const gaugeContract = new web3.eth.Contract(
          CONTRACTS.GAUGE_ABI as AbiItem[],
          gaugeAddress
        );

        const [totalSupply, gaugeBalance, bribeAddress] = await Promise.all([
          gaugeContract.methods.totalSupply().call(),
          gaugeContract.methods.balanceOf(account.address).call(),
          gaugesContract.methods.external_bribes(gaugeAddress).call(),
        ]);
        //wrapped bribe address is coming from api. if the api doesnt work this will break
        const bribeContract = new web3.eth.Contract(
          CONTRACTS.BRIBE_ABI as AbiItem[],
          thePair.gauge.wrapped_bribe_address
        );

        const tokensLength = await bribeContract.methods
          .rewardsListLength()
          .call();
        const arry = Array.from(
          { length: parseInt(tokensLength) },
          (v, i) => i
        );

        const bribes = await Promise.all(
          arry.map(async (idx) => {
            const tokenAddress = await bribeContract.methods
              .rewards(idx)
              .call();
            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await gaugeContract.methods
              .rewardRate(tokenAddress)
              .call();

            return {
              token: token,
              rewardAmount: BigNumber(rewardRate)
                .times(604800)
                .div(10 ** token.decimals)
                .toFixed(token.decimals),
            };
          })
        );

        thePair.gauge = {
          address: gaugeAddress,
          bribeAddress: bribeAddress,
          decimals: 18,
          balance: BigNumber(gaugeBalance)
            .div(10 ** 18)
            .toFixed(18),
          totalSupply: BigNumber(totalSupply)
            .div(10 ** 18)
            .toFixed(18),
          weight: BigNumber(gaugeWeight)
            .div(10 ** 18)
            .toFixed(18),
          weightPercent: BigNumber(gaugeWeight)
            .times(100)
            .div(totalWeight)
            .toFixed(2),
          bribes: bribes,
        };
      }

      pairs.push(thePair);
      this.setStore({ pairs: pairs });

      return thePair;
    } catch (ex) {
      console.log(ex);
      return null;
    }
  };

  getPair = async (addressA: string, addressB: string, stab: boolean) => {
    if (addressA === NATIVE_TOKEN.symbol) {
      addressA = W_NATIVE_ADDRESS;
    }
    if (addressB === NATIVE_TOKEN.symbol) {
      addressB = W_NATIVE_ADDRESS;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      console.warn("web3 not found");
      return null;
    }
    const account = stores.accountStore.getStore("account");
    if (!account) {
      console.warn("account not found");
      return null;
    }

    const pairs = this.getStore("pairs");
    let thePair: any = pairs.filter((pair) => {
      return (
        (pair.token0.address.toLowerCase() == addressA.toLowerCase() &&
          pair.token1.address.toLowerCase() == addressB.toLowerCase() &&
          pair.stable == stab) ||
        (pair.token0.address.toLowerCase() == addressB.toLowerCase() &&
          pair.token1.address.toLowerCase() == addressA.toLowerCase() &&
          pair.stable == stab)
      );
    });
    if (thePair.length > 0) {
      const pc = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        thePair[0].address
      );

      const [totalSupply, reserve0, reserve1, balanceOf] = await Promise.all([
        pc.methods.totalSupply().call(),
        pc.methods.reserve0().call(),
        pc.methods.reserve1().call(),
        pc.methods.balanceOf(account.address).call(),
      ]);

      const returnPair = thePair[0];
      returnPair.balance = BigNumber(balanceOf)
        .div(10 ** PAIR_DECIMALS)
        .toFixed(PAIR_DECIMALS);
      returnPair.totalSupply = BigNumber(totalSupply)
        .div(10 ** PAIR_DECIMALS)
        .toFixed(PAIR_DECIMALS);
      returnPair.reserve0 = BigNumber(reserve0)
        .div(10 ** returnPair.token0.decimals)
        .toFixed(parseInt(returnPair.token0.decimals));
      returnPair.reserve1 = BigNumber(reserve1)
        .div(10 ** returnPair.token1.decimals)
        .toFixed(parseInt(returnPair.token1.decimals));

      return returnPair;
    }

    const factoryContract = new web3.eth.Contract(
      CONTRACTS.FACTORY_ABI as AbiItem[],
      CONTRACTS.FACTORY_ADDRESS
    );
    const pairAddress = await factoryContract.methods
      .getPair(addressA, addressB, stab)
      .call();

    if (pairAddress && pairAddress != ZERO_ADDRESS) {
      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        pairAddress
      );
      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      const totalWeight = await gaugesContract.methods.totalWeight().call();

      const [
        token0,
        token1,
        totalSupply,
        symbol,
        reserve0,
        reserve1,
        decimals,
        balanceOf,
        stable,
        gaugeAddress,
        gaugeWeight,
      ] = await Promise.all([
        pairContract.methods.token0().call(),
        pairContract.methods.token1().call(),
        pairContract.methods.totalSupply().call(),
        pairContract.methods.symbol().call(),
        pairContract.methods.reserve0().call(),
        pairContract.methods.reserve1().call(),
        pairContract.methods.decimals().call(),
        pairContract.methods.balanceOf(account.address).call(),
        pairContract.methods.stable().call(),
        gaugesContract.methods.gauges(pairAddress).call(),
        gaugesContract.methods.weights(pairAddress).call(),
      ]);

      const token0Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        token0
      );
      const token1Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        token1
      );

      const [
        token0Symbol,
        token0Decimals,
        token0Balance,
        token1Symbol,
        token1Decimals,
        token1Balance,
      ] = await Promise.all([
        token0Contract.methods.symbol().call(),
        token0Contract.methods.decimals().call(),
        token0Contract.methods.balanceOf(account.address).call(),
        token1Contract.methods.symbol().call(),
        token1Contract.methods.decimals().call(),
        token1Contract.methods.balanceOf(account.address).call(),
      ]);

      thePair = {
        address: pairAddress,
        symbol: symbol,
        decimals: parseInt(decimals),
        stable,
        token0: {
          address: token0,
          symbol: token0Symbol,
          balance: BigNumber(token0Balance)
            .div(10 ** token0Decimals)
            .toFixed(parseInt(token0Decimals)),
          decimals: parseInt(token0Decimals),
        },
        token1: {
          address: token1,
          symbol: token1Symbol,
          balance: BigNumber(token1Balance)
            .div(10 ** token1Decimals)
            .toFixed(parseInt(token1Decimals)),
          decimals: parseInt(token1Decimals),
        },
        balance: BigNumber(balanceOf)
          .div(10 ** decimals)
          .toFixed(parseInt(decimals)),
        totalSupply: BigNumber(totalSupply)
          .div(10 ** decimals)
          .toFixed(parseInt(decimals)),
        reserve0: BigNumber(reserve0)
          .div(10 ** token0Decimals)
          .toFixed(parseInt(token0Decimals)),
        reserve1: BigNumber(reserve1)
          .div(10 ** token1Decimals)
          .toFixed(parseInt(token1Decimals)),
      };

      if (gaugeAddress !== ZERO_ADDRESS) {
        const gaugeContract = new web3.eth.Contract(
          CONTRACTS.GAUGE_ABI as AbiItem[],
          gaugeAddress
        );

        const [totalSupply, gaugeBalance, bribeAddress] = await Promise.all([
          gaugeContract.methods.totalSupply().call(),
          gaugeContract.methods.balanceOf(account.address).call(),
          gaugesContract.methods.external_bribes(gaugeAddress).call(),
        ]);

        const bribeContract = new web3.eth.Contract(
          CONTRACTS.BRIBE_ABI as AbiItem[],
          thePair.gauge.wrapped_bribe_address
        );

        const tokensLength = await bribeContract.methods
          .rewardsListLength()
          .call();
        const arry = Array.from(
          { length: parseInt(tokensLength) },
          (v, i) => i
        );

        const bribes = await Promise.all(
          arry.map(async (idx) => {
            const tokenAddress = await bribeContract.methods
              .rewards(idx)
              .call();
            const token = await this.getBaseAsset(tokenAddress);
            if (!token) return null;

            const rewardRate = await gaugeContract.methods
              .rewardRate(tokenAddress)
              .call();

            return {
              token: token,
              rewardRate: BigNumber(rewardRate)
                .div(10 ** token.decimals)
                .toFixed(token.decimals),
              rewardAmount: BigNumber(rewardRate)
                .times(604800)
                .div(10 ** token.decimals)
                .toFixed(token.decimals),
            };
          })
        );

        thePair.gauge = {
          address: gaugeAddress,
          bribeAddress: bribeAddress,
          decimals: 18,
          balance: BigNumber(gaugeBalance)
            .div(10 ** 18)
            .toFixed(18),
          totalSupply: BigNumber(totalSupply)
            .div(10 ** 18)
            .toFixed(18),
          weight: BigNumber(gaugeWeight)
            .div(10 ** 18)
            .toFixed(18),
          weightPercent: BigNumber(gaugeWeight)
            .times(100)
            .div(totalWeight)
            .toFixed(2),
          bribes: bribes,
        };
      }

      pairs.push(thePair);
      this.setStore({ pairs: pairs });

      return thePair;
    }

    return null;
  };

  removeBaseAsset = (asset: BaseAsset) => {
    try {
      let localBaseAssets: BaseAsset[] = [];
      const localBaseAssetsString = localStorage.getItem("stableSwap-assets");

      if (localBaseAssetsString && localBaseAssetsString !== "") {
        localBaseAssets = JSON.parse(localBaseAssetsString);

        localBaseAssets = localBaseAssets.filter((obj) => {
          return obj.address.toLowerCase() !== asset.address.toLowerCase();
        });

        localStorage.setItem(
          "stableSwap-assets",
          JSON.stringify(localBaseAssets)
        );

        let baseAssets = this.getStore("baseAssets");
        baseAssets = baseAssets.filter((obj) => {
          return (
            obj.address.toLowerCase() !== asset.address.toLowerCase() &&
            asset.local === true
          );
        });

        this.setStore({ baseAssets: baseAssets });
        this.updateSwapAssets(baseAssets);
        this.emitter.emit(ACTIONS.BASE_ASSETS_UPDATED, baseAssets);
      }
    } catch (ex) {
      console.log(ex);
      return null;
    }
  };

  getLocalAssets = () => {
    try {
      let localBaseAssets = [];
      const localBaseAssetsString = localStorage.getItem("stableSwap-assets");

      if (localBaseAssetsString && localBaseAssetsString !== "") {
        localBaseAssets = JSON.parse(localBaseAssetsString);
      }

      return localBaseAssets;
    } catch (ex) {
      console.log(ex);
      return [];
    }
  };

  getBaseAsset = async (
    address: string,
    save?: boolean,
    getBalance?: boolean
  ) => {
    try {
      const baseAssets = this.getStore("baseAssets");

      const theBaseAsset = baseAssets.filter((as) => {
        return as.address.toLowerCase() === address.toLowerCase();
      });
      if (theBaseAsset.length > 0) {
        return theBaseAsset[0];
      }

      // not found, so we search the blockchain for it.
      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const baseAssetContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        address
      );

      const [symbol, decimals, name] = await Promise.all([
        baseAssetContract.methods.symbol().call(),
        baseAssetContract.methods.decimals().call(),
        baseAssetContract.methods.name().call(),
      ]);

      const newBaseAsset: BaseAsset = {
        address: address,
        symbol: symbol,
        name: name,
        decimals: parseInt(decimals),
        logoURI: null,
        local: true,
        balance: null,
        isWhitelisted: undefined,
        listingFee: undefined,
      };

      if (getBalance) {
        const account = stores.accountStore.getStore("account");
        if (account) {
          const balanceOf = await baseAssetContract.methods
            .balanceOf(account.address)
            .call();
          newBaseAsset.balance = BigNumber(balanceOf)
            .div(10 ** newBaseAsset.decimals)
            .toFixed(newBaseAsset.decimals);
        }
      }

      //only save when a user adds it. don't for when we lookup a pair and find he asset.
      if (save) {
        let localBaseAssets = this.getLocalAssets();
        localBaseAssets = [...localBaseAssets, newBaseAsset];
        localStorage.setItem(
          "stableSwap-assets",
          JSON.stringify(localBaseAssets)
        );

        const baseAssets = this.getStore("baseAssets");
        const storeBaseAssets = [...baseAssets, newBaseAsset];

        this.setStore({ baseAssets: storeBaseAssets });
        this.updateSwapAssets(storeBaseAssets);
        this.emitter.emit(ACTIONS.BASE_ASSETS_UPDATED, storeBaseAssets);
      }

      return newBaseAsset;
    } catch (ex) {
      console.log(ex);
      // this.emitter.emit(ACTIONS.ERROR, ex)
      return null;
    }
  };

  // DISPATCHER FUNCTIONS
  configure = async () => {
    try {
      this.setStore({ govToken: this._getGovTokenBase() });
      this.setStore({ veToken: this._getVeTokenBase() });
      this.setStore({ baseAssets: await this._getBaseAssets() });
      this.setStore({ routeAssets: await this._getRouteAssets() });
      this.setStore({ pairs: await this._getPairs() });
      this.setStore({ swapAssets: this._getSwapAssets() });
      this.setStore({ updateDate: await stores.helper.getActivePeriod() });
      this.setStore({
        circulatingSupply: await stores.helper.getCirculatingSupply(), // TODO move to api
      });
      this.setStore({
        marketCap: await stores.helper.getMarketCap(), // TODO move to api
      });
      this.setStore({
        u_domain: await stores.helper.resolveUnstoppableDomain(),
      });

      this.emitter.emit(ACTIONS.UPDATED);
      this.emitter.emit(ACTIONS.CONFIGURED_SS);

      setTimeout(() => {
        this.dispatcher.dispatch({ type: ACTIONS.GET_BALANCES });
      }, 1);
    } catch (ex) {
      console.log(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getBaseAssets = async () => {
    try {
      // const response = await fetch(
      //   `${process.env.NEXT_PUBLIC_API}/api/v1/assets`,
      //   {
      //     method: 'get',
      //     headers: {
      //       Authorization: `Basic ${process.env.NEXT_PUBLIC_API_TOKEN}`
      //     }
      //   }
      // )
      // const baseAssetsCall = await response.json()

      let baseAssets = tokenlist;

      const set = new Set<string>(baseAssets.map((asset) => asset.address));
      if (!set.has(NATIVE_TOKEN.address)) baseAssets.unshift(NATIVE_TOKEN);

      let localBaseAssets = this.getLocalAssets();

      return [...baseAssets, ...localBaseAssets];
    } catch (ex) {
      console.log(ex);
      return [];
    }
  };

  _getRouteAssets = async () => {
    try {
      const response = await fetch(`/api/routes`);
      const routeAssetsCall = await response.json();
      return routeAssetsCall.data as RouteAsset[];
    } catch (ex) {
      console.log(ex);
      return [];
    }
  };

  _getPairs = async () => {
    try {
      const response = await fetch(`/api/pairs`);

      const pairsCall = await response.json();

      this.setStore({ tokenPrices: new Map(pairsCall.prices) });
      this.setStore({ tvl: pairsCall.tvl });

      return pairsCall.data;
    } catch (ex) {
      console.log(ex);
      return [];
    }
  };

  _getSwapAssets = () => {
    const baseAssets = this.getStore("baseAssets");
    const pairs = this.getStore("pairs");
    const set = new Set<string>();
    set.add(NATIVE_TOKEN.address.toLowerCase());
    pairs.forEach((pair) => {
      set.add(pair.token0.address.toLowerCase());
      set.add(pair.token1.address.toLowerCase());
    });
    const baseAssetsWeSwap = baseAssets.filter((asset) =>
      set.has(asset.address.toLowerCase())
    );
    return [...baseAssetsWeSwap];
  };
  updateSwapAssets = (payload: BaseAsset[]) => {
    const pairs = this.getStore("pairs");
    const set = new Set<string>();
    set.add(NATIVE_TOKEN.address.toLowerCase());
    pairs.forEach((pair) => {
      set.add(pair.token0.address.toLowerCase());
      set.add(pair.token1.address.toLowerCase());
    });
    const baseAssetsWeSwap = payload.filter((asset) =>
      set.has(asset.address.toLowerCase())
    );
    this.setStore({ swapAssets: baseAssetsWeSwap });
    this.emitter.emit(ACTIONS.SWAP_ASSETS_UPDATED, baseAssetsWeSwap);
  };

  _getGovTokenBase = () => {
    return {
      address: CONTRACTS.GOV_TOKEN_ADDRESS,
      name: CONTRACTS.GOV_TOKEN_NAME,
      symbol: CONTRACTS.GOV_TOKEN_SYMBOL,
      decimals: CONTRACTS.GOV_TOKEN_DECIMALS,
      logoURI: CONTRACTS.GOV_TOKEN_LOGO,
    };
  };

  _getVeTokenBase = () => {
    return {
      address: CONTRACTS.VE_TOKEN_ADDRESS,
      name: CONTRACTS.VE_TOKEN_NAME,
      symbol: CONTRACTS.VE_TOKEN_SYMBOL,
      decimals: CONTRACTS.VE_TOKEN_DECIMALS,
      logoURI: CONTRACTS.VE_TOKEN_LOGO,
    };
  };

  getBalances = async () => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      this._getGovTokenInfo(web3, account);
      await this._getBaseAssetInfo(web3, account);
      await this._getPairInfo(web3, account);
    } catch (ex) {
      console.log(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getVestNFTs = async (web3: Web3, account: { address: string }) => {
    try {
      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        throw new Error("veToken or govToken not found");
      }

      const vestingContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI,
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const nftsLength = await vestingContract.methods
        .balanceOf(account.address)
        .call();
      const arr = Array.from({ length: parseInt(nftsLength) }, (v, i) => i);

      const nfts = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await vestingContract.methods
            .tokenOfOwnerByIndex(account.address, idx)
            .call();
          const locked = await vestingContract.methods
            .locked(tokenIndex)
            .call();
          const lockValue = await vestingContract.methods
            .balanceOfNFT(tokenIndex)
            .call();

          // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
          return {
            id: tokenIndex,
            lockEnds: locked.end,
            lockAmount: BigNumber(locked.amount)
              .div(10 ** govToken.decimals)
              .toFixed(govToken.decimals),
            lockValue: BigNumber(lockValue)
              .div(10 ** veToken.decimals)
              .toFixed(veToken.decimals),
          };
        })
      );

      this.setStore({ vestNFTs: nfts });
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getGovTokenInfo = async (web3: Web3, account: { address: string }) => {
    try {
      const govToken = this.getStore("govToken");
      if (!govToken) {
        console.warn("govToken not found");
        return null;
      }

      const veTokenContract = new web3.eth.Contract(
        CONTRACTS.GOV_TOKEN_ABI,
        CONTRACTS.GOV_TOKEN_ADDRESS
      );

      const balanceOf = await veTokenContract.methods
        .balanceOf(account.address)
        .call();

      govToken.balanceOf = balanceOf;
      govToken.balance = BigNumber(balanceOf)
        .div(10 ** govToken.decimals)
        .toFixed(govToken.decimals);

      this.setStore({ govToken });
      this.emitter.emit(ACTIONS.UPDATED);

      this._getVestNFTs(web3, account);
    } catch (ex) {
      console.log(ex);
    }
  };

  _getPairInfo = async (
    web3: Web3,
    account: { address: string },
    overridePairs?: Pair[]
  ) => {
    try {
      const multicall = await stores.accountStore.getMulticall();

      let pairs: Pair[] = [];

      if (overridePairs) {
        pairs = overridePairs;
      } else {
        pairs = this.getStore("pairs");
      }

      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI,
        CONTRACTS.VOTER_ADDRESS
      );

      const totalWeight = await gaugesContract.methods.totalWeight().call();

      const ps = await Promise.all(
        pairs.map(async (pair) => {
          try {
            const pairContract = new web3.eth.Contract(
              CONTRACTS.PAIR_ABI,
              pair.address
            );

            const token0 = await this.getBaseAsset(
              pair.token0.address,
              false,
              true
            );
            const token1 = await this.getBaseAsset(
              pair.token1.address,
              false,
              true
            );

            const [totalSupply, reserves, balanceOf] =
              await multicall.aggregate([
                pairContract.methods.totalSupply(),
                pairContract.methods.getReserves(),
                pairContract.methods.balanceOf(account.address),
              ]);

            pair.token0 = token0 != null ? token0 : pair.token0;
            pair.token1 = token1 != null ? token1 : pair.token1;
            pair.balance = BigNumber(balanceOf)
              .div(10 ** PAIR_DECIMALS)
              .toFixed(PAIR_DECIMALS);
            pair.totalSupply = BigNumber(totalSupply)
              .div(10 ** PAIR_DECIMALS)
              .toFixed(PAIR_DECIMALS);
            pair.reserve0 = BigNumber(reserves[0])
              .div(10 ** pair.token0.decimals)
              .toFixed(pair.token0.decimals);
            pair.reserve1 = BigNumber(reserves[1])
              .div(10 ** pair.token1.decimals)
              .toFixed(pair.token1.decimals);

            return pair;
          } catch (ex) {
            console.log("EXCEPTION 1");
            console.log(pair);
            console.log(ex);
            return pair;
          }
        })
      );

      this.setStore({ pairs: ps });
      this.emitter.emit(ACTIONS.UPDATED);

      const ps1 = await Promise.all(
        ps.map(async (pair) => {
          try {
            if (pair.symbol.includes("mooCanto")) {
              pair.symbol = formatMooPairSymbol(pair.symbol);
              pair.token0.symbol = formatMooTokenSymbol(pair.token0.symbol);
              pair.token1.symbol = formatMooTokenSymbol(pair.token1.symbol);
            }

            if (pair.gauge && pair.gauge.address !== ZERO_ADDRESS) {
              const gaugeContract = new web3.eth.Contract(
                CONTRACTS.GAUGE_ABI,
                pair.gauge.address
              );

              const isAliveGauge: boolean = await gaugesContract.methods
                .isAlive(pair.gauge.address)
                .call();

              const [totalSupply, gaugeBalance, gaugeWeight] =
                await multicall.aggregate([
                  gaugeContract.methods.totalSupply(),
                  gaugeContract.methods.balanceOf(account.address),
                  gaugesContract.methods.weights(pair.address),
                ]);

              const bribes = pair.gauge.bribes.map((bribe) => {
                bribe.rewardAmount = bribe.rewardAmmount;
                bribe.tokenPrice = this.getStore("tokenPrices").get(
                  bribe.token.address.toLowerCase()
                );
                return bribe;
              });

              pair.gauge.balance = BigNumber(gaugeBalance)
                .div(10 ** 18)
                .toFixed(18);
              pair.gauge.totalSupply = BigNumber(totalSupply)
                .div(10 ** 18)
                .toFixed(18);
              pair.gauge.reserve0 =
                pair.totalSupply > 0
                  ? BigNumber(pair.reserve0)
                      .times(pair.gauge.totalSupply)
                      .div(pair.totalSupply)
                      .toFixed(pair.token0.decimals)
                  : "0";
              pair.gauge.reserve1 =
                pair.totalSupply > 0
                  ? BigNumber(pair.reserve1)
                      .times(pair.gauge.totalSupply)
                      .div(pair.totalSupply)
                      .toFixed(pair.token1.decimals)
                  : "0";
              pair.gauge.weight = BigNumber(gaugeWeight)
                .div(10 ** 18)
                .toFixed(18);
              pair.gauge.weightPercent = BigNumber(gaugeWeight)
                .times(100)
                .div(totalWeight)
                .toFixed(2);
              pair.gaugebribes = bribes;
              pair.isAliveGauge = isAliveGauge;
              if (isAliveGauge === false) pair.apr = 0;
            }

            return pair;
          } catch (ex) {
            console.log("EXCEPTION 2");
            console.log(pair);
            console.log(ex);
            return pair;
          }
        })
      );

      this.setStore({ pairs: ps1 });
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.log(ex);
    }
  };

  _getBaseAssetInfo = async (web3: Web3, account: { address: string }) => {
    try {
      const baseAssets = this.getStore("baseAssets");
      if (!baseAssets) {
        console.warn("baseAssets not found");
        return null;
      }

      const voterContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI,
        CONTRACTS.VOTER_ADDRESS
      );

      const baseAssetsBalances = await Promise.all(
        baseAssets.map(async (asset) => {
          try {
            if (asset.address === NATIVE_TOKEN.symbol) {
              let bal = await web3.eth.getBalance(account.address);
              return {
                balanceOf: bal,
                isWhitelisted: true,
              };
            }

            const assetContract = new web3.eth.Contract(
              CONTRACTS.ERC20_ABI,
              asset.address
            );

            const [isWhitelisted, balanceOf] = await Promise.all([
              voterContract.methods.isWhitelisted(asset.address).call(),
              assetContract.methods.balanceOf(account.address).call(),
            ]);

            return {
              balanceOf,
              isWhitelisted,
            };
          } catch (ex) {
            console.log("EXCEPTION 3");
            console.log(asset);
            console.log(ex);
            return {
              balanceOf: "0",
              isWhitelisted: false,
            };
          }
        })
      );

      for (let i = 0; i < baseAssets.length; i++) {
        baseAssets[i].balance = BigNumber(baseAssetsBalances[i].balanceOf)
          .div(10 ** baseAssets[i].decimals)
          .toFixed(baseAssets[i].decimals);
        baseAssets[i].isWhitelisted = baseAssetsBalances[i].isWhitelisted;
      }

      this.setStore({ baseAssets });
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.log(ex);
    }
  };

  searchBaseAsset = async (payload: {
    type: string;
    content: { address: string };
  }) => {
    try {
      let localBaseAssets: BaseAsset[] = [];
      const localBaseAssetsString = localStorage.getItem("stableSwap-assets");

      if (localBaseAssetsString && localBaseAssetsString !== "") {
        localBaseAssets = JSON.parse(localBaseAssetsString);
      }

      const theBaseAsset = localBaseAssets.filter((as) => {
        return (
          as.address.toLowerCase() === payload.content.address.toLowerCase()
        );
      });
      if (theBaseAsset.length > 0) {
        this.emitter.emit(ACTIONS.ASSET_SEARCHED, theBaseAsset);
        return;
      }
      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }
      const baseAssetContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        payload.content.address
      );

      const [symbol, decimals, name] = await Promise.all([
        baseAssetContract.methods.symbol().call(),
        baseAssetContract.methods.decimals().call(),
        baseAssetContract.methods.name().call(),
      ]);

      const newBaseAsset: BaseAsset = {
        address: payload.content.address,
        symbol: symbol,
        name: name,
        decimals: parseInt(decimals),
        balance: null,
        local: true,
        logoURI: "",
      };

      localBaseAssets = [...localBaseAssets, newBaseAsset];
      localStorage.setItem(
        "stableSwap-assets",
        JSON.stringify(localBaseAssets)
      );

      const baseAssets = this.getStore("baseAssets");
      const storeBaseAssets = [...baseAssets, ...localBaseAssets];

      this.setStore({ baseAssets: storeBaseAssets });

      this.emitter.emit(ACTIONS.ASSET_SEARCHED, newBaseAsset);
    } catch (ex) {
      console.log(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  createPairStake = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      amount0: string;
      amount1: string;
      isStable: boolean;
      token: any; // any coz we are not using it
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const {
        token0,
        token1,
        amount0,
        amount1,
        isStable: stable,
        token,
        slippage,
      } = payload.content;

      let toki0 = token0.address;
      let toki1 = token1.address;
      if (token0.address === NATIVE_TOKEN.symbol) {
        toki0 = W_NATIVE_ADDRESS;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        toki1 = W_NATIVE_ADDRESS;
      }

      const factoryContract = new web3.eth.Contract(
        CONTRACTS.FACTORY_ABI as AbiItem[],
        CONTRACTS.FACTORY_ADDRESS
      );
      const pairFor = await factoryContract.methods
        .getPair(toki0, toki1, stable)
        .call();

      if (pairFor && pairFor != ZERO_ADDRESS) {
        await context.updatePairsCall(web3, account);
        this.emitter.emit(ACTIONS.ERROR, "Pair already exists");
        return null;
      }

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowance0TXID = this.getTXUUID();
      let allowance1TXID = this.getTXUUID();
      let depositTXID = this.getTXUUID();
      let createGaugeTXID = this.getTXUUID();
      let stakeAllowanceTXID = this.getTXUUID();
      let stakeTXID = this.getTXUUID();

      //DOD A CHECK FOR IF THE POOL ALREADY EXISTS

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Create liquidity pool for ${token0.symbol}/${token1.symbol}`,
        type: "Liquidity",
        verb: "Liquidity Pool Created",
        transactions: [
          {
            uuid: allowance0TXID,
            description: `Checking your ${token0.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: allowance1TXID,
            description: `Checking your ${token1.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: depositTXID,
            description: `Create liquidity pool`,
            status: "WAITING",
          },
          {
            uuid: createGaugeTXID,
            description: `Create gauge`,
            status: "WAITING",
          },
          {
            uuid: stakeAllowanceTXID,
            description: `Checking your pool allowance`,
            status: "WAITING",
          },
          {
            uuid: stakeTXID,
            description: `Stake LP tokens in the gauge`,
            status: "WAITING",
          },
        ],
      });

      let allowance0: string | null = "0";
      let allowance1: string | null = "0";

      // CHECK ALLOWANCES AND SET TX DISPLAY
      if (token0.address !== NATIVE_TOKEN.symbol) {
        allowance0 = await this._getDepositAllowance(web3, token0, account);
        if (!allowance0) throw new Error("Couldnt get allowance");
        if (BigNumber(allowance0).lt(amount0)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allow the router to spend your ${token0.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allowance on ${token0.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance0 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance0TXID,
          description: `Allowance on ${token0.symbol} sufficient`,
          status: "DONE",
        });
      }

      if (token1.address !== NATIVE_TOKEN.symbol) {
        allowance1 = await this._getDepositAllowance(web3, token1, account);
        if (!allowance1) throw new Error("Couldnt get allowance");
        if (BigNumber(allowance1).lt(amount1)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allow the router to spend your ${token1.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allowance on ${token1.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance1 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance1TXID,
          description: `Allowance on ${token1.symbol} sufficient`,
          status: "DONE",
        });
      }

      const gasPrice = await stores.accountStore.getGasPrice();

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance0).lt(amount0)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token0.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance0TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      if (BigNumber(allowance1).lt(amount1)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token1.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance1TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT DEPOSIT TRANSACTION
      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const sendAmount0 = BigNumber(amount0)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1 = BigNumber(amount1)
        .times(10 ** token1.decimals)
        .toFixed(0);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(amount0)
        .times(sendSlippage)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1Min = BigNumber(amount1)
        .times(sendSlippage)
        .times(10 ** token1.decimals)
        .toFixed(0);

      let func = "addLiquidity";
      let params = [
        token0.address,
        token1.address,
        stable,
        sendAmount0,
        sendAmount1,
        sendAmount0Min,
        sendAmount1Min,
        account.address,
        deadline,
      ];
      let sendValue = null;

      if (token0.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token1.address,
          stable,
          sendAmount1,
          sendAmount1Min,
          sendAmount0Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount0;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token0.address,
          stable,
          sendAmount0,
          sendAmount0Min,
          sendAmount1Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount1;
      }

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      this._callContractWait(
        routerContract,
        func,
        params,
        account,
        depositTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          // GET PAIR FOR NEWLY CREATED LIQUIDITY POOL
          let tok0 = token0.address;
          let tok1 = token1.address;
          if (token0.address === NATIVE_TOKEN.symbol) {
            tok0 = W_NATIVE_ADDRESS;
          }
          if (token1.address === NATIVE_TOKEN.symbol) {
            tok1 = W_NATIVE_ADDRESS;
          }
          const pairFor = await factoryContract.methods
            .getPair(tok0, tok1, stable)
            .call();

          // SUBMIT CREATE GAUGE TRANSACTION
          const gaugesContract = new web3.eth.Contract(
            CONTRACTS.VOTER_ABI as AbiItem[],
            CONTRACTS.VOTER_ADDRESS
          );
          this._callContractWait(
            gaugesContract,
            "createGauge",
            [pairFor],
            account,
            createGaugeTXID,
            async (err) => {
              if (err) {
                return this.emitter.emit(ACTIONS.ERROR, err);
              }

              const gaugeAddress = await gaugesContract.methods
                .gauges(pairFor)
                .call();

              const pairContract = new web3.eth.Contract(
                CONTRACTS.PAIR_ABI as AbiItem[],
                pairFor
              );
              const gaugeContract = new web3.eth.Contract(
                CONTRACTS.GAUGE_ABI as AbiItem[],
                gaugeAddress
              );

              const balanceOf = await pairContract.methods
                .balanceOf(account.address)
                .call();
              // FIXME this throws and pair is null for some reason (fork issue? fe issue?)
              const pair = await this.getPairByAddress(pairFor);
              const stakeAllowance = await this._getStakeAllowance(
                web3,
                pair,
                account,
                pairFor
              );
              if (!stakeAllowance) throw new Error("stakeAllowance is null");
              if (
                BigNumber(stakeAllowance).lt(
                  BigNumber(balanceOf)
                    .div(10 ** PAIR_DECIMALS)
                    .toFixed(PAIR_DECIMALS)
                )
              ) {
                this.emitter.emit(ACTIONS.TX_STATUS, {
                  uuid: stakeAllowanceTXID,
                  description: `Allow the router to spend your ${pair.symbol}`,
                });
              } else {
                this.emitter.emit(ACTIONS.TX_STATUS, {
                  uuid: stakeAllowanceTXID,
                  description: `Allowance on ${pair.symbol} sufficient`,
                  status: "DONE",
                });
              }

              const allowanceCallsPromise = [];

              if (
                BigNumber(stakeAllowance).lt(
                  BigNumber(balanceOf)
                    .div(10 ** PAIR_DECIMALS)
                    .toFixed(PAIR_DECIMALS)
                )
              ) {
                const stakePromise = new Promise<void>((resolve, reject) => {
                  context._callContractWait(
                    pairContract,
                    "approve",
                    [pair.gauge.address, MAX_UINT256],
                    account,
                    stakeAllowanceTXID,
                    (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      resolve();
                    }
                  );
                });

                allowanceCallsPromise.push(stakePromise);
              }

              const done = await Promise.all(allowanceCallsPromise);

              let sendTok = "0";
              // if (token && token.id) {
              //   sendTok = token.id;
              // }

              this._callContractWait(
                gaugeContract,
                "deposit",
                [balanceOf, sendTok],
                account,
                stakeTXID,
                async (err) => {
                  if (err) {
                    return this.emitter.emit(ACTIONS.ERROR, err);
                  }

                  await context.updatePairsCall(web3, account);

                  this.emitter.emit(ACTIONS.PAIR_CREATED, pairFor);
                }
              );
            }
          );
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  createPairDeposit = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      amount0: string;
      amount1: string;
      isStable: boolean;
      token: any; // any coz we are not using it
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const {
        token0,
        token1,
        amount0,
        amount1,
        isStable: stable,
        slippage,
      } = payload.content;

      let toki0 = token0.address;
      let toki1 = token1.address;
      if (token0.address === NATIVE_TOKEN.symbol) {
        toki0 = W_NATIVE_ADDRESS;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        toki1 = W_NATIVE_ADDRESS;
      }

      const factoryContract = new web3.eth.Contract(
        CONTRACTS.FACTORY_ABI as AbiItem[],
        CONTRACTS.FACTORY_ADDRESS
      );
      const pairFor = await factoryContract.methods
        .getPair(toki0, toki1, stable)
        .call();

      if (pairFor && pairFor != ZERO_ADDRESS) {
        await context.updatePairsCall(web3, account);
        this.emitter.emit(ACTIONS.ERROR, "Pair already exists");
        return null;
      }

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowance0TXID = this.getTXUUID();
      let allowance1TXID = this.getTXUUID();
      let depositTXID = this.getTXUUID();
      let createGaugeTXID = this.getTXUUID();

      //DOD A CHECK FOR IF THE POOL ALREADY EXISTS

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Create liquidity pool for ${token0.symbol}/${token1.symbol}`,
        type: "Liquidity",
        verb: "Liquidity Pool Created",
        transactions: [
          {
            uuid: allowance0TXID,
            description: `Checking your ${token0.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: allowance1TXID,
            description: `Checking your ${token1.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: depositTXID,
            description: `Create liquidity pool`,
            status: "WAITING",
          },
          {
            uuid: createGaugeTXID,
            description: `Create gauge`,
            status: "WAITING",
          },
        ],
      });

      let allowance0: string | null = "0";
      let allowance1: string | null = "0";

      // CHECK ALLOWANCES AND SET TX DISPLAY
      if (token0.address !== NATIVE_TOKEN.symbol) {
        allowance0 = await this._getDepositAllowance(web3, token0, account);
        if (!allowance0) throw new Error("Error getting allowance0");
        if (BigNumber(allowance0).lt(amount0)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allow the router to spend your ${token0.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allowance on ${token0.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance0 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance0TXID,
          description: `Allowance on ${token0.symbol} sufficient`,
          status: "DONE",
        });
      }

      if (token1.address !== NATIVE_TOKEN.symbol) {
        allowance1 = await this._getDepositAllowance(web3, token1, account);
        if (!allowance1) throw new Error("couldnt get allowance");
        if (BigNumber(allowance1).lt(amount1)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allow the router to spend your ${token1.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allowance on ${token1.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance1 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance1TXID,
          description: `Allowance on ${token1.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance0).lt(amount0)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token0.address
        );
        console.log(CONTRACTS.ROUTER_ADDRESS);
        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance0TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      if (BigNumber(allowance1).lt(amount1)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token1.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance1TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT DEPOSIT TRANSACTION
      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const sendAmount0 = BigNumber(amount0)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1 = BigNumber(amount1)
        .times(10 ** token1.decimals)
        .toFixed(0);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(amount0)
        .times(sendSlippage)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1Min = BigNumber(amount1)
        .times(sendSlippage)
        .times(10 ** token1.decimals)
        .toFixed(0);

      let func = "addLiquidity";
      let params = [
        token0.address,
        token1.address,
        stable,
        sendAmount0,
        sendAmount1,
        sendAmount0Min,
        sendAmount1Min,
        account.address,
        deadline,
      ];
      let sendValue = null;

      if (token0.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token1.address,
          stable,
          sendAmount1,
          sendAmount1Min,
          sendAmount0Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount0;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token0.address,
          stable,
          sendAmount0,
          sendAmount0Min,
          sendAmount1Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount1;
      }

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      this._callContractWait(
        routerContract,
        func,
        params,
        account,
        depositTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          // GET PAIR FOR NEWLY CREATED LIQUIDITY POOL
          let tok0 = token0.address;
          let tok1 = token1.address;
          if (token0.address === NATIVE_TOKEN.symbol) {
            tok0 = W_NATIVE_ADDRESS;
          }
          if (token1.address === NATIVE_TOKEN.symbol) {
            tok1 = W_NATIVE_ADDRESS;
          }
          const pairFor = await factoryContract.methods
            .getPair(tok0, tok1, stable)
            .call();

          // SUBMIT CREATE GAUGE TRANSACTION
          const gaugesContract = new web3.eth.Contract(
            CONTRACTS.VOTER_ABI as AbiItem[],
            CONTRACTS.VOTER_ADDRESS
          );
          this._callContractWait(
            gaugesContract,
            "createGauge",
            [pairFor],
            account,
            createGaugeTXID,
            async (err) => {
              if (err) {
                return this.emitter.emit(ACTIONS.ERROR, err);
              }

              await context.updatePairsCall(web3, account);

              this.emitter.emit(ACTIONS.PAIR_CREATED, pairFor);
            }
          );
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  updatePairsCall = async (web3: Web3, account: { address: string }) => {
    try {
      // update pairs is same endpoint in API. Pairs are updated in sync on backend
      const response = await fetch(`/api/pairs`);
      const pairsCall = await response.json();
      this.setStore({ pairs: pairsCall.data });

      await this._getPairInfo(web3, account, pairsCall.data);
    } catch (ex) {
      console.log(ex);
    }
  };

  sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  getTXUUID = () => {
    return uuidv4();
  };

  addLiquidity = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      amount0: string;
      amount1: string;
      minLiquidity: any;
      pair: Pair;
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { token0, token1, amount0, amount1, minLiquidity, pair, slippage } =
        payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowance0TXID = this.getTXUUID();
      let allowance1TXID = this.getTXUUID();
      let depositTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Add liquidity to ${pair.symbol}`,
        verb: "Liquidity Added",
        type: "Liquidity",
        transactions: [
          {
            uuid: allowance0TXID,
            description: `Checking your ${token0.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: allowance1TXID,
            description: `Checking your ${token1.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: depositTXID,
            description: `Deposit tokens in the pool`,
            status: "WAITING",
          },
        ],
      });

      let allowance0: string | null = "0";
      let allowance1: string | null = "0";

      // CHECK ALLOWANCES AND SET TX DISPLAY
      if (token0.address !== NATIVE_TOKEN.symbol) {
        allowance0 = await this._getDepositAllowance(web3, token0, account);
        if (!allowance0) throw new Error("Error getting allowance");
        if (BigNumber(allowance0).lt(amount0)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allow the router to spend your ${token0.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allowance on ${token0.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance0 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance0TXID,
          description: `Allowance on ${token0.symbol} sufficient`,
          status: "DONE",
        });
      }

      if (token1.address !== NATIVE_TOKEN.symbol) {
        allowance1 = await this._getDepositAllowance(web3, token1, account);
        if (!allowance1) throw new Error("couldnt get allowance");
        if (BigNumber(allowance1).lt(amount1)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allow the router to spend your ${token1.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allowance on ${token1.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance1 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance1TXID,
          description: `Allowance on ${token1.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance0).lt(amount0)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token0.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance0TXID,
            (err) => {
              if (err) {
                console.log(err);
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      if (BigNumber(allowance1).lt(amount1)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token1.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance1TXID,
            (err) => {
              if (err) {
                console.log(err);
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT DEPOSIT TRANSACTION
      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const sendAmount0 = BigNumber(amount0)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1 = BigNumber(amount1)
        .times(10 ** token1.decimals)
        .toFixed(0);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(amount0)
        .times(sendSlippage)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1Min = BigNumber(amount1)
        .times(sendSlippage)
        .times(10 ** token1.decimals)
        .toFixed(0);

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );

      let func = "addLiquidity";
      let params = [
        token0.address,
        token1.address,
        pair.stable,
        sendAmount0,
        sendAmount1,
        sendAmount0Min,
        sendAmount1Min,
        account.address,
        deadline,
      ];
      let sendValue = null;

      if (token0.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token1.address,
          pair.stable,
          sendAmount1,
          sendAmount1Min,
          sendAmount0Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount0;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token0.address,
          pair.stable,
          sendAmount0,
          sendAmount0Min,
          sendAmount1Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount1;
      }

      this._callContractWait(
        routerContract,
        func,
        params,
        account,
        depositTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getPairInfo(web3, account);

          this.emitter.emit(ACTIONS.LIQUIDITY_ADDED);
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  stakeLiquidity = async (payload: {
    type: string;
    content: { pair: Pair; token: any };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair, token } = payload.content;

      let stakeAllowanceTXID = this.getTXUUID();
      let stakeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Stake ${pair.symbol} in the gauge`,
        type: "Liquidity",
        verb: "Liquidity Staked",
        transactions: [
          {
            uuid: stakeAllowanceTXID,
            description: `Checking your ${pair.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: stakeTXID,
            description: `Stake LP tokens in the gauge`,
            status: "WAITING",
          },
        ],
      });

      const stakeAllowance = await this._getStakeAllowance(web3, pair, account);
      if (!stakeAllowance) throw new Error("Error getting stake allowance");

      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        pair.address
      );
      const balanceOf = await pairContract.methods
        .balanceOf(account.address)
        .call();

      if (
        BigNumber(stakeAllowance).lt(
          BigNumber(balanceOf)
            .div(10 ** PAIR_DECIMALS)
            .toFixed(PAIR_DECIMALS)
        )
      ) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: stakeAllowanceTXID,
          description: `Allow the router to spend your ${pair.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: stakeAllowanceTXID,
          description: `Allowance on ${pair.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      if (!pair.gauge?.address) throw new Error("Gauge address is undefined");

      if (
        BigNumber(stakeAllowance).lt(
          BigNumber(balanceOf)
            .div(10 ** PAIR_DECIMALS)
            .toFixed(PAIR_DECIMALS)
        )
      ) {
        const stakePromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            pairContract,
            "approve",
            [pair.gauge?.address, MAX_UINT256],
            account,
            stakeAllowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(stakePromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as AbiItem[],
        pair.gauge.address
      );

      let sendTok = "0";
      // if (token && token.id) {
      //   sendTok = token.id;
      // }

      this._callContractWait(
        gaugeContract,
        "deposit",
        [balanceOf, sendTok],
        account,
        stakeTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getPairInfo(web3, account);

          this.emitter.emit(ACTIONS.LIQUIDITY_STAKED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  addLiquidityAndStake = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      amount0: string;
      amount1: string;
      minLiquidity: string;
      pair: Pair;
      token: any;
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const {
        token0,
        token1,
        amount0,
        amount1,
        minLiquidity,
        pair,
        token,
        slippage,
      } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowance0TXID = this.getTXUUID();
      let allowance1TXID = this.getTXUUID();
      let stakeAllowanceTXID = this.getTXUUID();
      let depositTXID = this.getTXUUID();
      let stakeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Add liquidity to ${pair.symbol}`,
        type: "Liquidity",
        verb: "Liquidity Added",
        transactions: [
          {
            uuid: allowance0TXID,
            description: `Checking your ${token0.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: allowance1TXID,
            description: `Checking your ${token1.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: stakeAllowanceTXID,
            description: `Checking your ${pair.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: depositTXID,
            description: `Deposit tokens in the pool`,
            status: "WAITING",
          },
          {
            uuid: stakeTXID,
            description: `Stake LP tokens in the gauge`,
            status: "WAITING",
          },
        ],
      });

      let allowance0: string | null = "0";
      let allowance1: string | null = "0";

      // CHECK ALLOWANCES AND SET TX DISPLAY
      if (token0.address !== NATIVE_TOKEN.symbol) {
        allowance0 = await this._getDepositAllowance(web3, token0, account);
        if (!allowance0) throw new Error();
        if (BigNumber(allowance0).lt(amount0)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allow the router to spend your ${token0.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance0TXID,
            description: `Allowance on ${token0.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance0 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance0TXID,
          description: `Allowance on ${token0.symbol} sufficient`,
          status: "DONE",
        });
      }

      if (token1.address !== NATIVE_TOKEN.symbol) {
        allowance1 = await this._getDepositAllowance(web3, token1, account);
        if (!allowance1) throw new Error("couldnt get allowance");
        if (BigNumber(allowance1).lt(amount1)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allow the router to spend your ${token1.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowance1TXID,
            description: `Allowance on ${token1.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance1 = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowance1TXID,
          description: `Allowance on ${token1.symbol} sufficient`,
          status: "DONE",
        });
      }

      const stakeAllowance = await this._getStakeAllowance(web3, pair, account);
      if (!stakeAllowance) throw new Error("Error getting stake allowance");

      if (BigNumber(stakeAllowance).lt(minLiquidity)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: stakeAllowanceTXID,
          description: `Allow the router to spend your ${pair.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: stakeAllowanceTXID,
          description: `Allowance on ${pair.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance0).lt(amount0)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token0.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance0TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      if (BigNumber(allowance1).lt(amount1)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          token1.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowance1TXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      if (!pair.gauge?.address) throw new Error("Gauge address is undefined");

      if (BigNumber(stakeAllowance).lt(minLiquidity)) {
        const pairContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          pair.address
        );

        const stakePromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            pairContract,
            "approve",
            [pair.gauge?.address, MAX_UINT256],
            account,
            stakeAllowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(stakePromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT DEPOSIT TRANSACTION
      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const sendAmount0 = BigNumber(amount0)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1 = BigNumber(amount1)
        .times(10 ** token1.decimals)
        .toFixed(0);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(amount0)
        .times(sendSlippage)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1Min = BigNumber(amount1)
        .times(sendSlippage)
        .times(10 ** token1.decimals)
        .toFixed(0);

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as AbiItem[],
        pair.gauge.address
      );
      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        pair.address
      );

      let func = "addLiquidity";
      let params = [
        token0.address,
        token1.address,
        pair.stable,
        sendAmount0,
        sendAmount1,
        sendAmount0Min,
        sendAmount1Min,
        account.address,
        deadline,
      ];
      let sendValue = null;

      if (token0.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token1.address,
          pair.stable,
          sendAmount1,
          sendAmount1Min,
          sendAmount0Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount0;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        func = "addLiquidityETH";
        params = [
          token0.address,
          pair.stable,
          sendAmount0,
          sendAmount0Min,
          sendAmount1Min,
          account.address,
          deadline,
        ];
        sendValue = sendAmount1;
      }

      this._callContractWait(
        routerContract,
        func,
        params,
        account,
        depositTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          const balanceOf = await pairContract.methods
            .balanceOf(account.address)
            .call();

          let sendTok = "0";
          // if (token && token.id) {
          //   sendTok = token.id;
          // }

          this._callContractWait(
            gaugeContract,
            "deposit",
            [balanceOf, sendTok],
            account,
            stakeTXID,
            (err) => {
              if (err) {
                return this.emitter.emit(ACTIONS.ERROR, err);
              }

              this._getPairInfo(web3, account);

              this.emitter.emit(ACTIONS.ADD_LIQUIDITY_AND_STAKED);
            }
          );
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getDepositAllowance = async (
    web3: Web3,
    token: BaseAsset,
    account: { address: string }
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        token.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, CONTRACTS.ROUTER_ADDRESS)
        .call();
      return BigNumber(allowance)
        .div(10 ** token.decimals)
        .toFixed(token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getStakeAllowance = async (
    web3: Web3,
    pair: Pair,
    account: { address: string },
    pairAddress?: string
  ) => {
    try {
      let tokenContract;
      if (pair === null && !!pairAddress) {
        tokenContract = new web3.eth.Contract(CONTRACTS.ERC20_ABI, pairAddress);
      } else {
        tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI,
          pair.address
        );
      }
      const allowance = await tokenContract.methods
        .allowance(account.address, pair.gauge?.address)
        .call();
      return BigNumber(allowance)
        .div(10 ** PAIR_DECIMALS)
        .toFixed(PAIR_DECIMALS);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getWithdrawAllowance = async (
    web3: Web3,
    pair: Pair,
    account: { address: string }
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        pair.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, CONTRACTS.ROUTER_ADDRESS)
        .call();
      return BigNumber(allowance)
        .div(10 ** PAIR_DECIMALS)
        .toFixed(PAIR_DECIMALS);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  quoteAddLiquidity = async (payload: {
    type: string;
    content: {
      pair: Pair;
      token0: BaseAsset;
      token1: BaseAsset;
      amount0: string;
      amount1: string;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair, token0, token1, amount0, amount1 } = payload.content;

      if (!pair || !token0 || !token1 || amount0 == "" || amount1 == "") {
        return null;
      }

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );

      const sendAmount0 = BigNumber(amount0)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1 = BigNumber(amount1)
        .times(10 ** token1.decimals)
        .toFixed(0);

      let addy0 = token0.address;
      let addy1 = token1.address;

      if (token0.address === NATIVE_TOKEN.symbol) {
        addy0 = W_NATIVE_ADDRESS;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        addy1 = W_NATIVE_ADDRESS;
      }

      const res = await routerContract.methods
        .quoteAddLiquidity(addy0, addy1, pair.stable, sendAmount0, sendAmount1)
        .call();

      const returnVal = {
        inputs: {
          token0,
          token1,
          amount0,
          amount1,
        },
        output: BigNumber(res.liquidity)
          .div(10 ** PAIR_DECIMALS)
          .toFixed(PAIR_DECIMALS),
      };
      this.emitter.emit(ACTIONS.QUOTE_ADD_LIQUIDITY_RETURNED, returnVal);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  getLiquidityBalances = async (payload: {
    type: string;
    content: { pair: Pair };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair } = payload.content;

      if (!pair) {
        return;
      }

      const token0Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        pair.token0.address
      );
      const token1Contract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        pair.token1.address
      );
      const pairContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI as AbiItem[],
        pair.address
      );

      const balanceCalls = [
        token0Contract.methods.balanceOf(account.address).call(),
        token1Contract.methods.balanceOf(account.address).call(),
        pairContract.methods.balanceOf(account.address).call(),
      ];

      if (pair.gauge) {
        const gaugeContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          pair.gauge.address
        );
        balanceCalls.push(
          gaugeContract.methods.balanceOf(account.address).call()
        );
      }

      const [token0Balance, token1Balance, poolBalance, gaugeBalance] =
        await Promise.all(balanceCalls);

      const returnVal: {
        token0: string;
        token1: string;
        pool: string;
        gauge: string | null;
      } = {
        token0: BigNumber(token0Balance)
          .div(10 ** pair.token0.decimals)
          .toFixed(pair.token0.decimals),
        token1: BigNumber(token1Balance)
          .div(10 ** pair.token1.decimals)
          .toFixed(pair.token1.decimals),
        pool: BigNumber(poolBalance)
          .div(10 ** 18)
          .toFixed(18),
        gauge: null,
      };

      if (pair.gauge) {
        returnVal.gauge = gaugeBalance
          ? BigNumber(gaugeBalance)
              .div(10 ** 18)
              .toFixed(18)
          : null;
      }

      this.emitter.emit(ACTIONS.GET_LIQUIDITY_BALANCES_RETURNED, returnVal);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  removeLiquidity = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      pair: Pair;
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { token0, token1, pair, slippage } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let withdrawTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Remove liquidity from ${pair.symbol}`,
        type: "Liquidity",
        verb: "Liquidity Removed",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${pair.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: withdrawTXID,
            description: `Withdraw tokens from the pool`,
            status: "WAITING",
          },
        ],
      });

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await this._getWithdrawAllowance(web3, pair, account);
      if (!allowance) throw new Error("Error getting withdraw allowance");
      if (!pair.balance) throw new Error("No pair balance");
      if (BigNumber(allowance).lt(pair.balance)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow the router to spend your ${pair.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${pair.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(pair.balance)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          pair.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                console.log(err);
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT WITHDRAW TRANSACTION
      const sendAmount = BigNumber(pair.balance)
        .times(10 ** PAIR_DECIMALS)
        .toFixed(0);

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );

      const quoteRemove = await routerContract.methods
        .quoteRemoveLiquidity(
          token0.address,
          token1.address,
          pair.stable,
          sendAmount
        )
        .call();

      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(quoteRemove.amountA)
        .times(sendSlippage)
        .toFixed(0);
      const sendAmount1Min = BigNumber(quoteRemove.amountB)
        .times(sendSlippage)
        .toFixed(0);

      this._callContractWait(
        routerContract,
        "removeLiquidity",
        [
          token0.address,
          token1.address,
          pair.stable,
          sendAmount,
          sendAmount0Min,
          sendAmount1Min,
          account.address,
          deadline,
        ],
        account,
        withdrawTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getPairInfo(web3, account);

          this.emitter.emit(ACTIONS.LIQUIDITY_REMOVED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  unstakeAndRemoveLiquidity = async (payload: {
    type: string;
    content: {
      token0: BaseAsset;
      token1: BaseAsset;
      amount: string;
      amount0: string;
      amount1: string;
      pair: Pair;
      slippage: string;
    };
  }) => {
    try {
      const context = this;

      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { token0, token1, amount, amount0, amount1, pair, slippage } =
        payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let withdrawTXID = this.getTXUUID();
      let unstakeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Remove liquidity from ${pair.symbol}`,
        type: "Liquidity",
        verb: "Liquidity Removed",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${pair.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: unstakeTXID,
            description: `Unstake LP tokens from the gauge`,
            status: "WAITING",
          },
          {
            uuid: withdrawTXID,
            description: `Withdraw tokens from the pool`,
            status: "WAITING",
          },
        ],
      });

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await this._getWithdrawAllowance(web3, pair, account);
      if (!allowance) throw new Error("Error getting withdraw allowance");

      if (BigNumber(allowance).lt(amount)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow the router to spend your ${pair.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${pair.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(amount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          pair.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.ROUTER_ADDRESS, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT DEPOSIT TRANSACTION
      const sendSlippage = BigNumber(100).minus(slippage).div(100);
      const sendAmount = BigNumber(amount)
        .times(10 ** PAIR_DECIMALS)
        .toFixed(0);
      const deadline = "" + moment().add(600, "seconds").unix();
      const sendAmount0Min = BigNumber(amount0)
        .times(sendSlippage)
        .times(10 ** token0.decimals)
        .toFixed(0);
      const sendAmount1Min = BigNumber(amount1)
        .times(sendSlippage)
        .times(10 ** token1.decimals)
        .toFixed(0);

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as AbiItem[],
        pair.gauge?.address
      );
      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as AbiItem[],
        pair.address
      );

      this._callContractWait(
        gaugeContract,
        "withdraw",
        [sendAmount],
        account,
        unstakeTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          const balanceOf = await pairContract.methods
            .balanceOf(account.address)
            .call();

          this._callContractWait(
            routerContract,
            "removeLiquidity",
            [
              token0.address,
              token1.address,
              pair.stable,
              balanceOf,
              sendAmount0Min,
              sendAmount1Min,
              account.address,
              deadline,
            ],
            account,
            withdrawTXID,
            (err) => {
              if (err) {
                return this.emitter.emit(ACTIONS.ERROR, err);
              }

              this._getPairInfo(web3, account);

              this.emitter.emit(ACTIONS.REMOVE_LIQUIDITY_AND_UNSTAKED);
            }
          );
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  unstakeLiquidity = async (payload: {
    type: string;
    content: { amount: string; pair: Pair };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { amount, pair } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let unstakeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Unstake liquidity from gauge`,
        type: "Liquidity",
        verb: "Liquidity Unstaked",
        transactions: [
          {
            uuid: unstakeTXID,
            description: `Unstake LP tokens from the gauge`,
            status: "WAITING",
          },
        ],
      });

      // SUBMIT WITHDRAW TRANSACTION
      const sendAmount = BigNumber(amount)
        .times(10 ** PAIR_DECIMALS)
        .toFixed(0);

      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as AbiItem[],
        pair.gauge?.address
      );

      this._callContractWait(
        gaugeContract,
        "withdraw",
        [sendAmount],
        account,
        unstakeTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getPairInfo(web3, account);

          this.emitter.emit(ACTIONS.LIQUIDITY_UNSTAKED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  quoteRemoveLiquidity = async (payload: {
    type: string;
    content: {
      pair: Pair;
      token0: BaseAsset;
      token1: BaseAsset;
      withdrawAmount: string;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair, token0, token1, withdrawAmount } = payload.content;

      if (!pair || !token0 || !token1 || withdrawAmount == "") {
        return null;
      }

      const routerContract = new web3.eth.Contract(
        CONTRACTS.ROUTER_ABI as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );

      const sendWithdrawAmount = BigNumber(withdrawAmount)
        .times(10 ** PAIR_DECIMALS)
        .toFixed(0);

      const res = await routerContract.methods
        .quoteRemoveLiquidity(
          token0.address,
          token1.address,
          pair.stable,
          sendWithdrawAmount
        )
        .call();

      const returnVal = {
        inputs: {
          token0,
          token1,
          withdrawAmount,
        },
        output: {
          amount0: BigNumber(res.amountA)
            .div(10 ** token0.decimals)
            .toFixed(token0.decimals),
          amount1: BigNumber(res.amountB)
            .div(10 ** token1.decimals)
            .toFixed(token1.decimals),
        },
      };
      this.emitter.emit(ACTIONS.QUOTE_REMOVE_LIQUIDITY_RETURNED, returnVal);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  createGauge = async (payload: { type: string; content: { pair: Pair } }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let createGaugeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Create liquidity gauge for ${pair.token0.symbol}/${pair.token1.symbol}`,
        type: "Liquidity",
        verb: "Gauge Created",
        transactions: [
          {
            uuid: createGaugeTXID,
            description: `Create gauge`,
            status: "WAITING",
          },
        ],
      });

      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );
      this._callContractWait(
        gaugesContract,
        "createGauge",
        [pair.address],
        account,
        createGaugeTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          await this.updatePairsCall(web3, account);

          this.emitter.emit(ACTIONS.CREATE_GAUGE_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  quoteSwap = async (payload: {
    type: string;
    content: {
      fromAsset: BaseAsset;
      toAsset: BaseAsset;
      fromAmount: string;
      slippage: number;
    };
  }) => {
    const address = stores.accountStore.getStore("account")?.address;
    if (!address) throw new Error("no address");
    try {
      const res = await fetch("/api/firebird-router", {
        method: "POST",
        body: JSON.stringify({
          payload,
          address,
        }),
      });
      const resJson = (await res.json()) as QuoteSwapResponse;

      const returnValue = resJson;

      this.emitter.emit(ACTIONS.QUOTE_SWAP_RETURNED, returnValue);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.QUOTE_SWAP_RETURNED, null);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  swap = async (payload: {
    type: string;
    content: {
      quote: QuoteSwapResponse;
      fromAsset: BaseAsset;
      toAsset: BaseAsset;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { quote, fromAsset, toAsset } = payload.content;

      const fromAmount = BigNumber(quote.maxReturn.totalFrom)
        .div(10 ** fromAsset.decimals)
        .toFixed(fromAsset.decimals);

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let swapTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Swap ${fromAsset.symbol} for ${toAsset.symbol}`,
        type: "Swap",
        verb: "Swap Successful",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${fromAsset.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: swapTXID,
            description: `Swap ${formatCurrency(fromAmount)} ${
              fromAsset.symbol
            } for ${toAsset.symbol}`,
            status: "WAITING",
          },
        ],
      });

      let allowance: string | null = "0";

      // CHECK ALLOWANCES AND SET TX DISPLAY
      if (fromAsset.address !== NATIVE_TOKEN.symbol) {
        allowance = await this._getFirebirdSwapAllowance(
          web3,
          fromAsset,
          account,
          quote
        );
        if (!allowance) throw new Error("Couldn't fetch allowance");
        if (BigNumber(allowance).lt(fromAmount)) {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowanceTXID,
            description: `Allow the router to spend your ${fromAsset.symbol}`,
          });
        } else {
          this.emitter.emit(ACTIONS.TX_STATUS, {
            uuid: allowanceTXID,
            description: `Allowance on ${fromAsset.symbol} sufficient`,
            status: "DONE",
          });
        }
      } else {
        allowance = MAX_UINT256;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${fromAsset.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];
      if (!allowance) throw new Error("Couldn't fetch allowance");
      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(fromAmount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          fromAsset.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            tokenContract,
            "approve",
            [quote.encodedData.router, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT SWAP TRANSACTION
      const tx = {
        from: account.address, // signer address
        to: quote.encodedData.router, // router address
        gasPrice: quote.maxReturn.gasPrice,
        data: quote.encodedData.data, // encoded contract data
        value:
          quote.maxReturn.from === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
            ? quote.maxReturn.totalFrom
            : undefined,
      };

      this._sendTransactionWait(web3, tx, swapTXID, (err) => {
        if (err) {
          return this.emitter.emit(ACTIONS.ERROR, err);
        }

        this._getSpecificAssetInfo(web3, account, fromAsset.address);
        this._getSpecificAssetInfo(web3, account, toAsset.address); // TODO use this
        this._getPairInfo(web3, account);

        this.emitter.emit(ACTIONS.SWAP_RETURNED);
      });
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  wrapOrUnwrap = async (payload: {
    type: string;
    content: { fromAsset: BaseAsset; toAsset: BaseAsset; fromAmount: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { fromAsset, toAsset, fromAmount } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let wrapUnwrapTXID = this.getTXUUID();
      let isWrap;
      let tx;
      if (fromAsset.symbol === "WCANTO" && toAsset.symbol === "CANTO") {
        isWrap = false;
        tx = {
          title: `Unwrap WCANTO for CANTO`,
          type: "Unwrap",
          verb: "Unwrap Successful",
          transactions: [
            {
              uuid: wrapUnwrapTXID,
              description: `Unwrap ${formatCurrency(
                fromAmount
              )} WCANTO for CANTO`,
              status: "WAITING",
            },
          ],
        };
      } else if (fromAsset.symbol === "CANTO" && toAsset.symbol === "WCANTO") {
        isWrap = true;
        tx = {
          title: `Wrap CANTO for WCANTO`,
          type: "Wrap",
          verb: "Wrap Successful",
          transactions: [
            {
              uuid: wrapUnwrapTXID,
              description: `Wrap ${formatCurrency(
                fromAmount
              )} CANTO for WCANTO`,
              status: "WAITING",
            },
          ],
        };
      } else {
        throw new Error("Wrap Unwrap assets are wrong");
      }

      this.emitter.emit(ACTIONS.TX_ADDED, tx);

      // SUBMIT WRAP_UNWRAP TRANSACTION
      const sendFromAmount = BigNumber(fromAmount)
        .times(10 ** 18)
        .toFixed(0);

      const wethContract = new web3.eth.Contract(
        (CONTRACTS as CantoContracts).WCANTO_ABI as AbiItem[],
        W_NATIVE_ADDRESS
      );

      let func = "withdraw";
      let params = [sendFromAmount];
      let sendValue = null;

      if (isWrap) {
        func = "deposit";
        params = [];
        sendValue = sendFromAmount;
      }

      this._callContractWait(
        wethContract,
        func,
        params,
        account,
        wrapUnwrapTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getSpecificAssetInfo(web3, account, fromAsset.address);
          this._getSpecificAssetInfo(web3, account, toAsset.address);

          this.emitter.emit(ACTIONS.WRAP_UNWRAP_RETURNED);
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  redeem = async (payload: {
    type: string;
    content: { fromAmount: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { fromAmount } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let redeemTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Redeem Flow v1 for Flow v2`,
        type: "Redeem",
        verb: "Redeem Successful",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your Flow v1 allowance`,
            status: "WAITING",
          },
          {
            uuid: redeemTXID,
            description: `Redeeming your Flow v1 for Flow v2`,
            status: "WAITING",
          },
        ],
      });

      let allowance: string | null = "0";

      // // CHECK ALLOWANCES AND SET TX DISPLAY
      allowance = await this._getRedeemAllowance(web3, account);
      if (!allowance) throw new Error("Error getting allowance");
      if (BigNumber(allowance).lt(fromAmount)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow the Flow Convertor to spend your Flow v1`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on Flow v1 sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(fromAmount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          FLOW_V1_ADDRESS
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            tokenContract,
            "approve",
            [FLOW_CONVERTOR_ADDRESS, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT REDEEM TRANSACTION
      const sendFromAmount = BigNumber(fromAmount)
        .times(10 ** 18)
        .toFixed(0);

      const flowConvertor = new web3.eth.Contract(
        (CONTRACTS as CantoContracts).FLOW_CONVERTOR_ABI as AbiItem[],
        (CONTRACTS as CantoContracts).FLOW_CONVERTOR_ADDRESS
      );

      let func = "redeem";
      let params = [sendFromAmount];

      this._callContractWait(
        flowConvertor,
        func,
        params,
        account,
        redeemTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getSpecificAssetInfo(
            web3,
            account,
            CONTRACTS.GOV_TOKEN_ADDRESS
          );
          this._getPairInfo(web3, account);

          this.emitter.emit(ACTIONS.REDEEM_RETURNED);
        },
        null
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getSpecificAssetInfo = async (
    web3: Web3,
    account: { address: string },
    assetAddress: string
  ) => {
    try {
      const baseAssets = this.getStore("baseAssets");
      if (!baseAssets) {
        console.warn("baseAssets not found");
        return null;
      }

      const ba = await Promise.all(
        baseAssets.map(async (asset) => {
          if (asset.address.toLowerCase() === assetAddress.toLowerCase()) {
            if (asset.address === NATIVE_TOKEN.symbol) {
              let bal = await web3.eth.getBalance(account.address);
              asset.balance = BigNumber(bal)
                .div(10 ** asset.decimals)
                .toFixed(asset.decimals);
            } else {
              const assetContract = new web3.eth.Contract(
                CONTRACTS.ERC20_ABI,
                asset.address
              );

              const balanceOf = await assetContract.methods
                .balanceOf(account.address)
                .call();

              asset.balance = BigNumber(balanceOf)
                .div(10 ** asset.decimals)
                .toFixed(asset.decimals);
            }
          }

          return asset;
        })
      );

      this.setStore({ baseAssets: ba });
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.log(ex);
      return null;
    }
  };

  _getFirebirdSwapAllowance = async (
    web3: Web3,
    token: BaseAsset,
    account: { address: string },
    quote: QuoteSwapResponse
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        token.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, quote.encodedData.router)
        .call();
      return BigNumber(allowance)
        .div(10 ** token.decimals)
        .toFixed(token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getSwapAllowance = async (
    web3: Web3,
    token: BaseAsset,
    account: { address: string }
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        token.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, CONTRACTS.ROUTER_ADDRESS)
        .call();
      return BigNumber(allowance)
        .div(10 ** token.decimals)
        .toFixed(token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getRedeemAllowance = async (web3: Web3, account: { address: string }) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        (CONTRACTS as CantoContracts).FLOW_V1_ADDRESS
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, FLOW_CONVERTOR_ADDRESS)
        .call();
      return BigNumber(allowance)
        .div(10 ** 18)
        .toFixed(18);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  getVestNFTs = async () => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        throw new Error("veToken or govToken not found");
      }

      const vestingContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const nftsLength = await vestingContract.methods
        .balanceOf(account.address)
        .call();
      const arr = Array.from({ length: parseInt(nftsLength) }, (v, i) => i);

      const nfts = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await vestingContract.methods
            .tokenOfOwnerByIndex(account.address, idx)
            .call();
          const locked = await vestingContract.methods
            .locked(tokenIndex)
            .call();
          const lockValue = await vestingContract.methods
            .balanceOfNFT(tokenIndex)
            .call();

          const voted = await this._checkNFTVotedEpoch(web3, tokenIndex);

          // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
          return {
            id: tokenIndex,
            lockEnds: locked.end,
            lockAmount: BigNumber(locked.amount)
              .div(10 ** govToken.decimals)
              .toFixed(govToken.decimals),
            lockValue: BigNumber(lockValue)
              .div(10 ** veToken.decimals)
              .toFixed(veToken.decimals),
            voted,
          };
        })
      );

      this.setStore({ vestNFTs: nfts });
      this.emitter.emit(ACTIONS.VEST_NFTS_RETURNED, nfts);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  createVest = async (payload: {
    type: string;
    content: { amount: string; unlockTime: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const govToken = this.getStore("govToken");
      if (!govToken) throw new Error("No gov token");
      const { amount, unlockTime } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let vestTXID = this.getTXUUID();

      const unlockString = moment()
        .add(unlockTime, "seconds")
        .format("YYYY-MM-DD");

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Vest ${govToken.symbol} until ${unlockString}`,
        type: "Vest",
        verb: "Vest Created",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${govToken.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: vestTXID,
            description: `Vesting your tokens`,
            status: "WAITING",
          },
        ],
      });

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await this._getVestAllowance(web3, govToken, account);
      if (!allowance) throw new Error("Error getting allowance in create vest");
      if (BigNumber(allowance).lt(amount)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow the vesting contract to use your ${govToken.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${govToken.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(amount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          govToken.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.VE_TOKEN_ADDRESS, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT VEST TRANSACTION
      const sendAmount = BigNumber(amount)
        .times(10 ** govToken.decimals)
        .toFixed(0);

      const veTokenContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      this._callContractWait(
        veTokenContract,
        "create_lock",
        [sendAmount, unlockTime + ""],
        account,
        vestTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getGovTokenInfo(web3, account);
          this.getNFTByID("fetchAll");

          this.emitter.emit(ACTIONS.CREATE_VEST_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getVestAllowance = async (
    web3: Web3,
    token: GovToken,
    account: { address: string }
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        token.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, CONTRACTS.VE_TOKEN_ADDRESS)
        .call();
      return BigNumber(allowance)
        .div(10 ** token.decimals)
        .toFixed(token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  increaseVestAmount = async (payload: {
    type: string;
    content: { amount: string; tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const govToken = this.getStore("govToken");
      if (!govToken)
        throw new Error("Error getting gov token in increase vest");
      const { amount, tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let vestTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Increase vest amount on token #${tokenID}`,
        type: "Vest",
        verb: "Vest Increased",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${govToken.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: vestTXID,
            description: `Increasing your vest amount`,
            status: "WAITING",
          },
        ],
      });

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await this._getVestAllowance(web3, govToken, account);
      if (!allowance)
        throw new Error("Error getting allowance in increase vest");
      if (BigNumber(allowance).lt(amount)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow vesting contract to use your ${govToken.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${govToken.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(amount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          govToken.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            tokenContract,
            "approve",
            [CONTRACTS.VE_TOKEN_ADDRESS, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT INCREASE TRANSACTION
      const sendAmount = BigNumber(amount)
        .times(10 ** govToken.decimals)
        .toFixed(0);

      const veTokenContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      this._callContractWait(
        veTokenContract,
        "increase_amount",
        [tokenID, sendAmount],
        account,
        vestTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._getGovTokenInfo(web3, account);
          this._updateVestNFTByID(tokenID);

          this.emitter.emit(ACTIONS.INCREASE_VEST_AMOUNT_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  increaseVestDuration = async (payload: {
    type: string;
    content: { unlockTime: string; tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID, unlockTime } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let vestTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Increase unlock time on token #${tokenID}`,
        type: "Vest",
        verb: "Vest Increased",
        transactions: [
          {
            uuid: vestTXID,
            description: `Increasing your vest duration`,
            status: "WAITING",
          },
        ],
      });

      // SUBMIT INCREASE TRANSACTION
      const veTokenContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      this._callContractWait(
        veTokenContract,
        "increase_unlock_time",
        [tokenID, unlockTime + ""],
        account,
        vestTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._updateVestNFTByID(tokenID);

          this.emitter.emit(ACTIONS.INCREASE_VEST_DURATION_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  resetVest = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }
      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let rewardsTXID = this.getTXUUID();
      let rebaseTXID = this.getTXUUID();
      let resetTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Reset veNFT #${tokenID}`,
        type: "Reset",
        verb: "Vest Reseted",
        transactions: [
          {
            uuid: rewardsTXID,
            description: `Checking unclaimed bribes`,
            status: "WAITING",
          },
          {
            uuid: rebaseTXID,
            description: `Checking unclaimed rebase distribution`,
            status: "WAITING",
          },
          {
            uuid: resetTXID,
            description: `Resetting your veNFT`,
            status: "WAITING",
          },
        ],
      });

      // CHECK unclaimed bribes
      await this.getRewardBalances({ type: "internal", content: { tokenID } });
      const rewards = this.getStore("rewards");

      if (rewards.bribes.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewardsTXID,
          description: `Unclaimed bribes found, claiming`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewardsTXID,
          description: `No unclaimed bribes found`,
          status: "DONE",
        });
      }

      if (rewards.bribes.length > 0) {
        const sendGauges = rewards.bribes.map((pair) => {
          return pair.gauge?.wrapped_bribe_address;
        });
        const sendTokens = rewards.bribes.map((pair) => {
          return pair.gauge?.bribesEarned?.map((bribe) => {
            return (bribe as Bribe).token.address;
          });
        });

        const voterContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            voterContract,
            "claimBribes",
            [sendGauges, sendTokens, tokenID],
            account,
            rewardsTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        await claimPromise;
      }

      if (rewards.veDist.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rebaseTXID,
          description: `Claiming rebase distribution`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rebaseTXID,
          description: `No unclaimed rebase`,
          status: "DONE",
        });
      }

      if (rewards.veDist.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const veDistContract = new web3.eth.Contract(
          CONTRACTS.VE_DIST_ABI as AbiItem[],
          CONTRACTS.VE_DIST_ADDRESS
        );

        const claimVeDistPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            veDistContract,
            "claim",
            [tokenID],
            account,
            rebaseTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        await claimVeDistPromise;
      }

      // SUBMIT RESET TRANSACTION
      const voterContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      this._callContractWait(
        voterContract,
        "reset",
        [tokenID],
        account,
        resetTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._updateVestNFTByID(tokenID);

          this.emitter.emit(ACTIONS.RESET_VEST_RETURNED);
        }
      );
    } catch (e) {
      console.log(e);
      console.log("RESET VEST ERROR");
    }
  };

  withdrawVest = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let rewardsTXID = this.getTXUUID();
      let rebaseTXID = this.getTXUUID();
      let resetTXID = this.getTXUUID();
      let vestTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Withdraw vest amount on token #${tokenID}`,
        type: "Vest",
        verb: "Vest Withdrawn",
        transactions: [
          {
            uuid: rewardsTXID,
            description: `Checking unclaimed bribes`,
            status: "WAITING",
          },
          {
            uuid: rebaseTXID,
            description: `Checking unclaimed rebase distribution`,
            status: "WAITING",
          },
          {
            uuid: resetTXID,
            description: `Checking if your has votes`,
            status: "WAITING",
          },
          {
            uuid: vestTXID,
            description: `Withdrawing your expired tokens`,
            status: "WAITING",
          },
        ],
      });

      // CHECK unclaimed bribes
      await this.getRewardBalances({ type: "internal", content: { tokenID } });
      const rewards = this.getStore("rewards");

      if (rewards.bribes.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewardsTXID,
          description: `Unclaimed bribes found, claiming`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewardsTXID,
          description: `No unclaimed bribes found`,
          status: "DONE",
        });
      }

      if (rewards.bribes.length > 0) {
        const sendGauges = rewards.bribes.map((pair) => {
          return pair.gauge?.wrapped_bribe_address;
        });
        const sendTokens = rewards.bribes.map((pair) => {
          return pair.gauge?.bribesEarned?.map((bribe) => {
            return (bribe as Bribe).token.address;
          });
        });

        const voterContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            voterContract,
            "claimBribes",
            [sendGauges, sendTokens, tokenID],
            account,
            rewardsTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        await claimPromise;
      }

      if (rewards.veDist.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rebaseTXID,
          description: `Claiming rebase distribution`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rebaseTXID,
          description: `No unclaimed rebase`,
          status: "DONE",
        });
      }

      if (rewards.veDist.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const veDistContract = new web3.eth.Contract(
          CONTRACTS.VE_DIST_ABI as AbiItem[],
          CONTRACTS.VE_DIST_ADDRESS
        );

        const claimVeDistPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            veDistContract,
            "claim",
            [tokenID],
            account,
            rebaseTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        await claimVeDistPromise;
      }

      // CHECK if veNFT has votes
      const voted = await this._checkNFTVoted(web3, tokenID);

      if (!!voted) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: resetTXID,
          description: `NFT has votes, resetting`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: resetTXID,
          description: `NFT doesn't have votes`,
          status: "DONE",
        });
      }

      const resetCallsPromise = [];

      if (!!voted) {
        const voterContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const resetPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            voterContract,
            "reset",
            [tokenID],
            account,
            resetTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        resetCallsPromise.push(resetPromise);
      }

      const done = await Promise.all(resetCallsPromise);

      // SUBMIT withdraw TRANSACTION
      const veTokenContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      this._callContractWait(
        veTokenContract,
        "withdraw",
        [tokenID],
        account,
        vestTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this._updateVestNFTByID(tokenID);

          this.emitter.emit(ACTIONS.WITHDRAW_VEST_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _checkNFTVotedEpoch = async (web3: Web3, tokenID: string) => {
    if (!web3) return false;

    const voterContract = new web3.eth.Contract(
      CONTRACTS.VOTER_ABI as AbiItem[],
      CONTRACTS.VOTER_ADDRESS
    );

    const _lastVoted = await voterContract.methods.lastVoted(tokenID).call();
    // if last voted eq 0, means never voted
    if (_lastVoted === "0") return false;
    const lastVoted = parseInt(_lastVoted);

    let nextEpochTimestamp = this.getStore("updateDate");
    // if user goes straight to vest page, updateDate maybe not set yet
    if (nextEpochTimestamp === 0) {
      nextEpochTimestamp = await stores.helper.getActivePeriod();
    }

    // 7 days epoch length
    const votedThisEpoch = lastVoted > nextEpochTimestamp - 7 * 24 * 60 * 60;
    return votedThisEpoch;
  };

  _checkNFTVoted = async (web3: Web3, tokenID: string) => {
    if (!web3) return;

    const votingEscrowContract = new web3.eth.Contract(
      CONTRACTS.VE_TOKEN_ABI as AbiItem[],
      CONTRACTS.VE_TOKEN_ADDRESS
    );

    const voted = await votingEscrowContract.methods.voted(tokenID).call();

    return voted;
  };

  vote = async (payload: {
    type: string;
    content: { votes: Votes; tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      // const govToken = this.getStore("govToken");
      const { tokenID, votes } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let voteTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Cast vote using token #${tokenID}`,
        verb: "Votes Cast",
        transactions: [
          {
            uuid: voteTXID,
            description: `Cast votes`,
            status: "WAITING",
          },
        ],
      });

      const pairs = this.getStore("pairs");
      let deadGauges: string[] = [];

      // SUBMIT INCREASE TRANSACTION
      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      let onlyVotes = votes.filter((vote) => {
        return BigNumber(vote.value).gt(0) || BigNumber(vote.value).lt(0);
      });

      const votesAddresses = onlyVotes.map((vote) => vote.address);
      const p = pairs.filter((pair) => {
        return votesAddresses.includes(pair.address);
      });
      p.forEach((pair) => {
        if (pair.isAliveGauge === false) {
          deadGauges.push(pair.symbol);
        }
      });

      if (deadGauges.length > 0) {
        const error_message = `Gauges ${deadGauges.join(
          ", "
        )} are dead and cannot be voted on`;
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: voteTXID,
          description: error_message,
        });
        throw new Error(error_message);
      }

      let tokens = onlyVotes.map((vote) => {
        return vote.address;
      });

      let voteCounts = onlyVotes.map((vote) => {
        return BigNumber(vote.value).times(100).toFixed(0);
      });

      this._callContractWait(
        gaugesContract,
        "vote",
        [parseInt(tokenID), tokens, voteCounts],
        account,
        voteTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this.emitter.emit(ACTIONS.VOTE_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  getVestVotes = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;
      const pairs = this.getStore("pairs");

      if (!pairs) {
        return null;
      }

      if (!tokenID) {
        return;
      }

      const filteredPairs = pairs.filter((pair) => {
        return pair && pair.gauge && pair.gauge.address;
      });

      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      const multicall = await stores.accountStore.getMulticall();

      const calls = filteredPairs.map((pair) => {
        return gaugesContract.methods.votes(tokenID, pair.address);
      });

      const voteCounts = (await multicall.aggregate(calls)) as string[];

      let votes: Vote[] = [];

      const totalVotes = voteCounts.reduce((curr, acc) => {
        let num = BigNumber(acc).gt(0)
          ? BigNumber(acc)
          : BigNumber(acc).times(-1);
        return BigNumber(curr).plus(num);
      }, BigNumber(0));

      for (let i = 0; i < voteCounts.length; i++) {
        votes.push({
          address: filteredPairs[i].address,
          votePercent:
            BigNumber(totalVotes).gt(0) || BigNumber(totalVotes).lt(0)
              ? BigNumber(voteCounts[i]).times(100).div(totalVotes).toFixed(0)
              : "0",
        });
      }

      this.emitter.emit(ACTIONS.VEST_VOTES_RETURNED, votes);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  createBribe = async (payload: {
    type: string;
    content: { asset: BaseAsset; amount: string; gauge: Pair };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { asset, amount, gauge } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let allowanceTXID = this.getTXUUID();
      let bribeTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Create bribe on ${gauge.token0.symbol}/${gauge.token1.symbol}`,
        verb: "Bribe Created",
        transactions: [
          {
            uuid: allowanceTXID,
            description: `Checking your ${asset.symbol} allowance`,
            status: "WAITING",
          },
          {
            uuid: bribeTXID,
            description: `Create bribe`,
            status: "WAITING",
          },
        ],
      });

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await this._getBribeAllowance(
        web3,
        asset,
        gauge,
        account
      );
      if (!allowance) throw new Error("Error getting bribe allowance");
      if (BigNumber(allowance).lt(amount)) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allow the bribe contract to spend your ${asset.symbol}`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: allowanceTXID,
          description: `Allowance on ${asset.symbol} sufficient`,
          status: "DONE",
        });
      }

      const allowanceCallsPromises = [];

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(amount)) {
        const tokenContract = new web3.eth.Contract(
          CONTRACTS.ERC20_ABI as AbiItem[],
          asset.address
        );

        const tokenPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            tokenContract,
            "approve",
            [gauge.gauge?.wrapped_bribe_address, MAX_UINT256],
            account,
            allowanceTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        allowanceCallsPromises.push(tokenPromise);
      }

      const done = await Promise.all(allowanceCallsPromises);

      // SUBMIT BRIBE TRANSACTION
      const bribeContract = new web3.eth.Contract(
        CONTRACTS.BRIBE_ABI as AbiItem[],
        gauge.gauge?.wrapped_bribe_address
      );

      const sendAmount = BigNumber(amount)
        .times(10 ** asset.decimals)
        .toFixed(0);

      this._callContractWait(
        bribeContract,
        "notifyRewardAmount",
        [asset.address, sendAmount],
        account,
        bribeTXID,
        async (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          await this.updatePairsCall(web3, account);

          this.emitter.emit(ACTIONS.BRIBE_CREATED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getBribeAllowance = async (
    web3: Web3,
    token: BaseAsset,
    pair: Pair,
    account: { address: string }
  ) => {
    try {
      const tokenContract = new web3.eth.Contract(
        CONTRACTS.ERC20_ABI,
        token.address
      );
      const allowance = await tokenContract.methods
        .allowance(account.address, pair.gauge?.wrapped_bribe_address)
        .call();
      return BigNumber(allowance)
        .div(10 ** token.decimals)
        .toFixed(token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  getVestBalances = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;
      const pairs = this.getStore("pairs");

      if (!pairs) {
        return null;
      }

      if (!tokenID) {
        return;
      }

      const filteredPairs = pairs.filter(hasGauge);

      const bribesEarned = await Promise.all(
        filteredPairs.map(async (pair) => {
          const bribesEarned = await Promise.all(
            pair.gauge.bribes.map(async (bribe) => {
              const bribeContract = new web3.eth.Contract(
                CONTRACTS.BRIBE_ABI as AbiItem[],
                pair.gauge?.wrapped_bribe_address
              );

              const earned = await bribeContract.methods
                .earned(bribe.token.address, tokenID)
                .call();

              return {
                earned: BigNumber(earned)
                  .div(10 ** bribe.token.decimals)
                  .toFixed(bribe.token.decimals),
              };
            })
          );
          pair.gauge.bribesEarnedValue = bribesEarned;

          return pair;
        })
      );

      this.emitter.emit(ACTIONS.VEST_BALANCES_RETURNED, bribesEarned);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  getRewardBalances = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;

      const pairs = this.getStore("pairs");
      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken)
        throw new Error(
          "Error getting veToken and govToken in getRewardBalances"
        );

      const filteredPairs = [...pairs.filter(hasGauge)];

      const filteredPairs2 = [...pairs.filter(hasGauge)];

      let veDistReward: VeDistReward[] = [];

      let filteredBribes: Pair[] = []; // Pair with rewardType set to "Bribe"

      if (tokenID) {
        const bribesEarned = await Promise.all(
          filteredPairs.map(async (pair) => {
            const bribesEarned = await Promise.all(
              pair.gauge.bribes.map(async (bribe) => {
                const bribeContract = new web3.eth.Contract(
                  CONTRACTS.BRIBE_ABI as AbiItem[],
                  pair.gauge?.wrapped_bribe_address
                );

                const earned = await bribeContract.methods
                  .earned(bribe.token.address, tokenID)
                  .call();

                bribe.earned = BigNumber(earned)
                  .div(10 ** bribe.token.decimals)
                  .toFixed(bribe.token.decimals);
                return bribe;
              })
            );

            pair.gauge.bribesEarned = bribesEarned;

            return pair;
          })
        );

        filteredBribes = bribesEarned
          .filter((pair) => {
            if (
              pair.gauge &&
              pair.gauge.bribesEarned &&
              pair.gauge.bribesEarned.length > 0
            ) {
              let shouldReturn = false;

              for (let i = 0; i < pair.gauge.bribesEarned.length; i++) {
                if (
                  pair.gauge.bribesEarned[i].earned &&
                  BigNumber(pair.gauge.bribesEarned[i].earned!).gt(0)
                ) {
                  shouldReturn = true;
                }
              }

              return shouldReturn;
            }

            return false;
          })
          .map((pair) => {
            pair.rewardType = "Bribe";
            return pair;
          });

        const veDistContract = new web3.eth.Contract(
          CONTRACTS.VE_DIST_ABI as AbiItem[],
          CONTRACTS.VE_DIST_ADDRESS
        );
        const veDistEarned = await veDistContract.methods
          .claimable(tokenID)
          .call();
        const vestNFTs = this.getStore("vestNFTs");
        let theNFT = vestNFTs.filter((vestNFT) => {
          return vestNFT.id == tokenID;
        });

        if (BigNumber(veDistEarned).gt(0)) {
          veDistReward.push({
            token: theNFT[0],
            lockToken: veToken,
            rewardToken: govToken,
            earned: BigNumber(veDistEarned)
              .div(10 ** govToken.decimals)
              .toFixed(govToken.decimals),
            rewardType: "Distribution",
          });
        }
      }

      const rewardsEarned = await Promise.all(
        filteredPairs2.map(async (pair) => {
          const gaugeContract = new web3.eth.Contract(
            CONTRACTS.GAUGE_ABI as AbiItem[],
            pair.gauge?.address
          );

          const [earned] = await Promise.all([
            gaugeContract.methods
              .earned(CONTRACTS.GOV_TOKEN_ADDRESS, account.address)
              .call(),
          ]);
          // bc filtered pairs
          pair.gauge.rewardsEarned = BigNumber(earned)
            .div(10 ** 18)
            .toFixed(18);
          return pair;
        })
      );

      const filteredRewards: Pair[] = []; // Pair with rewardType set to "Reward"
      for (let j = 0; j < rewardsEarned.length; j++) {
        let pair = Object.assign({}, rewardsEarned[j]);
        if (
          pair.gauge &&
          pair.gauge.rewardsEarned &&
          BigNumber(pair.gauge.rewardsEarned).gt(0)
        ) {
          pair.rewardType = "Reward";
          filteredRewards.push(pair);
        }
      }

      const rewards = {
        bribes: filteredBribes,
        rewards: filteredRewards,
        veDist: veDistReward,
      };

      this.setStore({
        rewards,
      });

      this.emitter.emit(ACTIONS.REWARD_BALANCES_RETURNED, rewards);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimBribes = async (payload: {
    type: string;
    content: {
      pair: Pair;
      tokenID: string;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair, tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let claimTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Claim rewards for ${pair.token0.symbol}/${pair.token1.symbol}`,
        verb: "Rewards Claimed",
        transactions: [
          {
            uuid: claimTXID,
            description: `Claiming your bribes`,
            status: "WAITING",
          },
        ],
      });

      // SUBMIT CLAIM TRANSACTION
      const gaugesContract = new web3.eth.Contract(
        CONTRACTS.VOTER_ABI as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      const sendGauges = [pair.gauge?.wrapped_bribe_address];
      const sendTokens = [
        pair.gauge?.bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        }),
      ];

      this._callContractWait(
        gaugesContract,
        "claimBribes",
        [sendGauges, sendTokens, tokenID],
        account,
        claimTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this.getRewardBalances({
            type: "Internal rewards balances",
            content: { tokenID },
          });
          this.emitter.emit(ACTIONS.CLAIM_REWARD_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimAllRewards = async (payload: {
    type: string;
    content: {
      pairs: Store["store"]["rewards"][keyof Store["store"]["rewards"]];
      tokenID: string;
    };
  }) => {
    try {
      const context = this;
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pairs, tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let claimTXID = this.getTXUUID();
      let rewardClaimTXIDs: string[] = [];
      let distributionClaimTXIDs: string[] = [];

      let bribePairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "Bribe";
      });

      let rewardPairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "Reward";
      });

      let distribution = (pairs as VeDistReward[]).filter((pair) => {
        return pair.rewardType === "Distribution";
      });

      const sendGauges = bribePairs.map((pair) => {
        return pair.gauge?.wrapped_bribe_address;
      });
      const sendTokens = bribePairs.map((pair) => {
        return pair.gauge?.bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        });
      });

      if (bribePairs.length == 0 && rewardPairs.length == 0) {
        this.emitter.emit(ACTIONS.ERROR, "Nothing to claim");
        this.emitter.emit(ACTIONS.CLAIM_ALL_REWARDS_RETURNED);
        return;
      }

      let sendOBJ: {
        title: string;
        verb: string;
        transactions: ITransaction["transactions"];
      } = {
        title: `Claim all rewards`,
        verb: "Rewards Claimed",
        transactions: [],
      };

      if (bribePairs.length > 0) {
        sendOBJ.transactions.push({
          uuid: claimTXID,
          description: `Claiming all your available bribes`,
          status: TransactionStatus.WAITING,
        });
      }

      if (rewardPairs.length > 0) {
        for (let i = 0; i < rewardPairs.length; i++) {
          const newClaimTX = this.getTXUUID();

          rewardClaimTXIDs.push(newClaimTX);
          sendOBJ.transactions.push({
            uuid: newClaimTX,
            description: `Claiming reward for ${rewardPairs[i].symbol}`,
            status: TransactionStatus.WAITING,
          });
        }
      }

      if (distribution.length > 0) {
        for (let i = 0; i < distribution.length; i++) {
          const newClaimTX = this.getTXUUID();

          distributionClaimTXIDs.push(newClaimTX);
          sendOBJ.transactions.push({
            uuid: newClaimTX,
            description: `Claiming distribution for NFT #${distribution[i].token.id}`,
            status: TransactionStatus.WAITING,
          });
        }
      }

      this.emitter.emit(ACTIONS.TX_ADDED, sendOBJ);

      if (bribePairs.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const gaugesContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            gaugesContract,
            "claimBribes",
            [sendGauges, sendTokens, tokenID],
            account,
            claimTXID,
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              resolve();
            }
          );
        });

        await Promise.all([claimPromise]);
      }

      if (rewardPairs.length > 0) {
        for (let i = 0; i < rewardPairs.length; i++) {
          const gaugeContract = new web3.eth.Contract(
            CONTRACTS.GAUGE_ABI as AbiItem[],
            rewardPairs[i].gauge?.address
          );
          const sendTok = [CONTRACTS.GOV_TOKEN_ADDRESS];

          const rewardPromise = new Promise<void>((resolve, reject) => {
            context._callContractWait(
              gaugeContract,
              "getReward",
              [account.address, sendTok],
              account,
              rewardClaimTXIDs[i],
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve();
              }
            );
          });

          await Promise.all([rewardPromise]);
        }
      }

      if (distribution.length > 0) {
        const veDistContract = new web3.eth.Contract(
          CONTRACTS.VE_DIST_ABI as AbiItem[],
          CONTRACTS.VE_DIST_ADDRESS
        );
        for (let i = 0; i < distribution.length; i++) {
          const rewardPromise = new Promise<void>((resolve, reject) => {
            context._callContractWait(
              veDistContract,
              "claim",
              [tokenID],
              account,
              distributionClaimTXIDs[i],
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve();
              }
            );
          });

          await Promise.all([rewardPromise]);
        }
      }

      this.getRewardBalances({
        type: "Internal reward balances",
        content: { tokenID },
      });
      this.emitter.emit(ACTIONS.CLAIM_ALL_REWARDS_RETURNED);
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimRewards = async (payload: {
    type: string;
    content: { pair: Pair; tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { pair, tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let claimTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Claim rewards for ${pair.token0.symbol}/${pair.token1.symbol}`,
        verb: "Rewards Claimed",
        transactions: [
          {
            uuid: claimTXID,
            description: `Claiming your rewards`,
            status: "WAITING",
          },
        ],
      });

      // SUBMIT CLAIM TRANSACTION
      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as AbiItem[],
        pair.gauge?.address
      );

      const sendTokens = [CONTRACTS.GOV_TOKEN_ADDRESS];

      this._callContractWait(
        gaugeContract,
        "getReward",
        [account.address, sendTokens],
        account,
        claimTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this.getRewardBalances({
            type: "internal reward balances",
            content: { tokenID },
          });
          this.emitter.emit(ACTIONS.CLAIM_REWARD_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimVeDist = async (payload: {
    type: string;
    content: { tokenID: string };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        console.warn("web3 not found");
        return null;
      }

      const { tokenID } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let claimTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Claim distribution for NFT #${tokenID}`,
        verb: "Rewards Claimed",
        transactions: [
          {
            uuid: claimTXID,
            description: `Claiming your distribution`,
            status: "WAITING",
          },
        ],
      });

      // SUBMIT CLAIM TRANSACTION
      const veDistContract = new web3.eth.Contract(
        CONTRACTS.VE_DIST_ABI as AbiItem[],
        CONTRACTS.VE_DIST_ADDRESS
      );

      this._callContractWait(
        veDistContract,
        "claim",
        [tokenID],
        account,
        claimTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }

          this.getRewardBalances({
            type: "internal reward balances",
            content: { tokenID },
          });
          this.emitter.emit(ACTIONS.CLAIM_VE_DIST_RETURNED);
        }
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _callContractWait = (
    contract: Contract,
    method: string,
    params: any[],
    account: { address: string },
    uuid: string,
    callback: (arg0: Error | string | null) => void | Promise<any> | boolean,
    sendValue: string | null | undefined = null
  ) => {
    this.emitter.emit(ACTIONS.TX_PENDING, { uuid });
    const gasCost = contract.methods[method](...params)
      .estimateGas({ from: account.address, value: sendValue })
      .then(async (estimatedGas: BigNumber) => [
        ...(await stores.accountStore.getGasPriceEIP1559()),
        estimatedGas,
      ])
      .then(
        ([maxFeePerGas, maxPriorityFeePerGas, estimatedGas]: [
          number,
          number,
          BigNumber
        ]) => {
          const context = this;
          contract.methods[method](...params)
            .send({
              from: account.address,
              gas: estimatedGas,
              value: sendValue,
              maxFeePerGas,
              maxPriorityFeePerGas,
            })
            .on("transactionHash", function (txHash: string) {
              context.emitter.emit(ACTIONS.TX_SUBMITTED, { uuid, txHash });
            })
            .on("receipt", function (receipt: TransactionReceipt) {
              context.emitter.emit(ACTIONS.TX_CONFIRMED, {
                uuid,
                txHash: receipt.transactionHash,
              });
              if (method !== "approve" && method !== "reset") {
                setTimeout(() => {
                  context.dispatcher.dispatch({ type: ACTIONS.GET_BALANCES });
                }, 1);
              }
              callback(null);
            })
            .on("error", function (error: Error) {
              if (!error.toString().includes("-32601")) {
                if (error.message) {
                  context.emitter.emit(ACTIONS.TX_REJECTED, {
                    uuid,
                    error: context._mapError(error.message),
                  });
                  return callback(error.message);
                }
                context.emitter.emit(ACTIONS.TX_REJECTED, {
                  uuid,
                  error: error,
                });
                callback(error);
              }
            })
            .catch((error: Error) => {
              if (!error.toString().includes("-32601")) {
                if (error.message) {
                  context.emitter.emit(ACTIONS.TX_REJECTED, {
                    uuid,
                    error: this._mapError(error.message),
                  });
                  return callback(error.message);
                }
                context.emitter.emit(ACTIONS.TX_REJECTED, {
                  uuid,
                  error: error,
                });
                callback(error);
              }
            });
        }
      )
      .catch((ex: Error) => {
        console.log(ex);
        if (ex.message) {
          this.emitter.emit(ACTIONS.TX_REJECTED, {
            uuid,
            error: this._mapError(ex.message),
          });
          return callback(ex.message);
        }
        this.emitter.emit(ACTIONS.TX_REJECTED, {
          uuid,
          error: "Error estimating gas",
        });
        callback(ex);
      });
  };

  _sendTransactionWait = (
    web3: Web3,
    tx: {
      from: string;
      to: string;
      gasPrice: number;
      data: string;
      value: string | undefined;
    },
    uuid: string,
    callback: (arg0: Error | null | string) => void
  ) => {
    this.emitter.emit(ACTIONS.TX_PENDING, { uuid });
    const sendTx = web3.eth.sendTransaction(tx);
    sendTx.on("transactionHash", (txHash) => {
      this.emitter.emit(ACTIONS.TX_SUBMITTED, { uuid, txHash });
    });
    sendTx.on("receipt", (receipt) => {
      this.emitter.emit(ACTIONS.TX_CONFIRMED, {
        uuid,
        txHash: receipt.transactionHash,
      });
      setTimeout(() => {
        this.dispatcher.dispatch({ type: ACTIONS.GET_BALANCES });
      }, 1);
      callback(null);
    });
    sendTx.on("error", (error) => {
      if (!error.toString().includes("-32601")) {
        if (error.message) {
          this.emitter.emit(ACTIONS.TX_REJECTED, {
            uuid,
            error: this._mapError(error.message),
          });
          return callback(error.message);
        }
        this.emitter.emit(ACTIONS.TX_REJECTED, {
          uuid,
          error: error,
        });
        callback(error);
      }
    });
    sendTx.catch((ex) => {
      console.log(ex);
      if (ex.message) {
        this.emitter.emit(ACTIONS.TX_REJECTED, {
          uuid,
          error: this._mapError(ex.message),
        });
        return callback(ex.message);
      }
      this.emitter.emit(ACTIONS.TX_REJECTED, {
        uuid,
        error: "Error estimating gas",
      });
      callback(ex);
    });
  };

  protected _mapError = (error: string) => {
    const errorMap = new Map<string, string>([
      // this happens with slingshot and metamask
      [
        "invalid height",
        "Canto RPC issue. Please try reload page/switch RPC/switch networks back and forth",
      ],
      [
        "attached",
        "You have already voted with this token or your nft is attached",
      ],
      ["TOKEN ALREADY VOTED", "You have already voted with this token"],
      [
        "TOKEN_ALREADY_VOTED_THIS_EPOCH",
        "You have already voted with this token",
      ],
      [
        "INSUFFICIENT A BALANCE",
        "Router doesn't have enough 'token in' balance",
      ],
      [
        "INSUFFICIENT_A_BALANCE",
        "Router doesn't have enough 'token in' balance",
      ],
      [
        "INSUFFICIENT B BALANCE",
        "Router doesn't have enough 'token out' balance",
      ],
      [
        "INSUFFICIENT_B_BALANCE",
        "Router doesn't have enough 'token out' balance",
      ],
      // some wallet some rpc not sure
      [
        "EIP-1559",
        "Canto RPC issue. Please try reload page/switch RPC/switch networks back and forth",
      ],
      // this happens in rubby
      [
        "request failed with status code 502",
        "Canto RPC issue. Please try reload page/switch RPC/switch networks back and forth",
      ],
      [
        "Request failed with status code 429",
        "RPC is being rate limited. Please try reload page/switch RPC/switch networks back and forth",
      ],
    ]);

    for (const [key, value] of errorMap) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return error;
  };
}

export default Store;
