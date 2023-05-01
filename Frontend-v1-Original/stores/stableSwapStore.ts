import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import type { Contract } from "web3-eth-contract";
import type { AbiItem } from "web3-utils";
import BigNumber from "bignumber.js";
import type Web3 from "web3";
import { TransactionReceipt } from "@ethersproject/providers";
import viemClient, { chunkArray, multicallChunks } from "./connectors/viem";
import {
  getContract,
  formatUnits,
  parseUnits,
  formatEther,
  parseEther,
} from "viem";
import { ethers } from "ethers";
import { getContract as wGetContract } from "@wagmi/core";

import { Dispatcher } from "flux";
import EventEmitter from "events";

import stores from ".";
import { formatCurrency } from "../utils/utils";
import {
  ACTIONS,
  CONTRACTS,
  MAX_UINT256,
  ZERO_ADDRESS,
  NATIVE_TOKEN,
  W_NATIVE_ADDRESS,
  W_NATIVE_ABI,
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
      xBribes: Gauge[];
      xxBribes: Gauge[];
      rewards: Gauge[];
      veDist: VeDistReward[];
    };
    updateDate: number;
    tokenPrices: Map<string, number>;
    tvl: number;
    tbv: number;
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
        xBribes: [],
        xxBribes: [],
        rewards: [],
        veDist: [],
      },
      updateDate: 0,
      tokenPrices: new Map(),
      tvl: 0,
      tbv: 0,
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
          case ACTIONS.MERGE_NFT:
            this.mergeNft(payload);
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
          // case ACTIONS.GET_VEST_BALANCES:
          //   this.getVestBalances(payload);
          //   break;

          //REWARDS
          case ACTIONS.GET_REWARD_BALANCES:
            this.getRewardBalances(payload);
            break;
          case ACTIONS.CLAIM_BRIBE:
            this.claimBribes(payload);
            break;
          case ACTIONS.CLAIM_X_BRIBE:
            this.claimXBribes(payload);
            break;
          case ACTIONS.CLAIM_XX_BRIBE:
            this.claimXXBribes(payload);
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

      const vestingContract = {
        abi: CONTRACTS.VE_TOKEN_ABI,
        address: CONTRACTS.VE_TOKEN_ADDRESS,
      } as const;

      const nftsLength = await viemClient.readContract({
        ...vestingContract,
        functionName: "balanceOf",
        args: [account.address],
      });
      const arr = Array.from(
        { length: parseInt(nftsLength.toString()) },
        (v, i) => i
      );

      const nfts: VestNFT[] = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await viemClient.readContract({
            ...vestingContract,
            functionName: "tokenOfOwnerByIndex",
            args: [account.address, BigInt(idx)],
          });
          const [[lockedAmount, lockedEnd], lockValue, voted] =
            await viemClient.multicall({
              allowFailure: false,
              multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
              contracts: [
                {
                  ...vestingContract,
                  functionName: "locked",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "balanceOfNFT",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "voted",
                  args: [tokenIndex],
                },
              ],
            });

          const [actionedInCurrentEpoch, lastVoted] =
            await this._checkNFTActionEpoch(tokenIndex.toString());

          return {
            id: tokenIndex.toString(),
            lockEnds: lockedEnd.toString(),
            lockAmount: formatUnits(lockedAmount, govToken.decimals),
            lockValue: formatUnits(lockValue, veToken.decimals),
            actionedInCurrentEpoch,
            reset: actionedInCurrentEpoch && !voted,
            lastVoted,
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

      const vestingContract = {
        abi: CONTRACTS.VE_TOKEN_ABI,
        address: CONTRACTS.VE_TOKEN_ADDRESS,
      } as const;

      const tokenIndex = await viemClient.readContract({
        ...vestingContract,
        functionName: "tokenOfOwnerByIndex",
        args: [account.address, BigInt(id)],
      });

      const [[lockedAmount, lockedEnd], lockValue, voted] =
        await viemClient.multicall({
          allowFailure: false,
          multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
          contracts: [
            {
              ...vestingContract,
              functionName: "locked",
              args: [tokenIndex],
            },
            {
              ...vestingContract,
              functionName: "balanceOfNFT",
              args: [tokenIndex],
            },
            {
              ...vestingContract,
              functionName: "voted",
              args: [tokenIndex],
            },
          ],
        });

      const [actionedInCurrentEpoch, lastVoted] =
        await this._checkNFTActionEpoch(id);

      const newVestNFTs: VestNFT[] = vestNFTs.map((nft) => {
        if (nft.id == id) {
          return {
            id: id,
            lockEnds: lockedEnd.toString(),
            lockAmount: formatUnits(lockedAmount, govToken.decimals),
            lockValue: formatUnits(lockValue, veToken.decimals),
            actionedInCurrentEpoch,
            reset: actionedInCurrentEpoch && !voted,
            lastVoted,
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

  getPairByAddress = async (pairAddress: `0x${string}`) => {
    try {
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
        const pc = {
          abi: CONTRACTS.PAIR_ABI,
          address: pairAddress,
        } as const;

        const [totalSupply, reserve0, reserve1, balanceOf] =
          await viemClient.multicall({
            allowFailure: false,
            multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
            contracts: [
              {
                ...pc,
                functionName: "totalSupply",
              },
              {
                ...pc,
                functionName: "reserve0",
              },
              {
                ...pc,
                functionName: "reserve1",
              },
              {
                ...pc,
                functionName: "balanceOf",
                args: [account.address],
              },
            ],
          });

        const returnPair = thePair[0];
        returnPair.balance = formatUnits(balanceOf, PAIR_DECIMALS);
        returnPair.totalSupply = formatUnits(totalSupply, PAIR_DECIMALS);
        returnPair.reserve0 = formatUnits(reserve0, returnPair.token0.decimals);
        returnPair.reserve1 = formatUnits(reserve1, returnPair.token1.decimals);

        return returnPair;
      }

      const pairContract = {
        abi: CONTRACTS.PAIR_ABI,
        address: pairAddress,
      } as const;
      const gaugesContract = {
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
      } as const;

      const totalWeight = await viemClient.readContract({
        ...gaugesContract,
        functionName: "totalWeight",
      });

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
      ] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...pairContract,
            functionName: "token0",
          },
          {
            ...pairContract,
            functionName: "token1",
          },
          {
            ...pairContract,
            functionName: "totalSupply",
          },
          {
            ...pairContract,
            functionName: "symbol",
          },
          {
            ...pairContract,
            functionName: "reserve0",
          },
          {
            ...pairContract,
            functionName: "reserve1",
          },
          {
            ...pairContract,
            functionName: "decimals",
          },
          {
            ...pairContract,
            functionName: "balanceOf",
            args: [account.address],
          },
          {
            ...pairContract,
            functionName: "stable",
          },
          {
            ...gaugesContract,
            functionName: "gauges",
            args: [pairAddress],
          },
          {
            ...gaugesContract,
            functionName: "weights",
            args: [pairAddress],
          },
        ],
      });

      const token0Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: token0,
      } as const;

      const token1Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: token1,
      } as const;

      const [
        token0Symbol,
        token0Decimals,
        token0Balance,
        token1Symbol,
        token1Decimals,
        token1Balance,
      ] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...token0Contract,
            functionName: "symbol",
          },
          {
            ...token0Contract,
            functionName: "decimals",
          },
          {
            ...token0Contract,
            functionName: "balanceOf",
            args: [account.address],
          },
          {
            ...token1Contract,
            functionName: "symbol",
          },
          {
            ...token1Contract,
            functionName: "decimals",
          },
          {
            ...token1Contract,
            functionName: "balanceOf",
            args: [account.address],
          },
        ],
      });

      thePair = {
        address: pairAddress,
        symbol: symbol,
        decimals: decimals,
        stable,
        token0: {
          address: token0,
          symbol: token0Symbol,
          balance: formatUnits(
            token0Balance,
            parseInt(token0Decimals.toString())
          ),
          decimals: parseInt(token0Decimals.toString()),
        },
        token1: {
          address: token1,
          symbol: token1Symbol,
          balance: formatUnits(
            token1Balance,
            parseInt(token1Decimals.toString())
          ),
          decimals: parseInt(token1Decimals.toString()),
        },
        balance: formatUnits(balanceOf, decimals),
        totalSupply: formatUnits(totalSupply, decimals),
        reserve0: formatUnits(reserve0, parseInt(token0Decimals.toString())),
        reserve1: formatUnits(reserve1, parseInt(token1Decimals.toString())),
        tvl: 0,
      };

      if (gaugeAddress !== ZERO_ADDRESS) {
        const gaugeContract = {
          abi: CONTRACTS.GAUGE_ABI,
          address: gaugeAddress,
        } as const;
        //wrapped bribe address is coming from api. if the api doesnt work this will break
        const bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.wrapped_bribe_address,
        } as const;
        const bribeContractInstance = getContract({
          ...bribeContract,
          publicClient: viemClient,
        });
        const x_bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.x_wrapped_bribe_address,
        } as const;
        const x_bribeContractInstance = getContract({
          ...x_bribeContract,
          publicClient: viemClient,
        });
        const xx_bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.xx_wrapped_bribe_address,
        } as const;
        const xx_bribeContractInstance = getContract({
          ...xx_bribeContract,
          publicClient: viemClient,
        });

        const [totalSupply, gaugeBalance, bribeAddress] =
          await viemClient.multicall({
            allowFailure: false,
            multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
            contracts: [
              {
                ...gaugeContract,
                functionName: "totalSupply",
              },
              {
                ...gaugeContract,
                functionName: "balanceOf",
                args: [account.address],
              },
              {
                ...gaugesContract,
                functionName: "external_bribes",
                args: [gaugeAddress],
              },
            ],
          });

        const tokensLength =
          await bribeContractInstance.read.rewardsListLength();
        const x_tokensLength =
          await x_bribeContractInstance.read.rewardsListLength();
        const xx_tokensLength =
          await xx_bribeContractInstance.read.rewardsListLength();

        const arry = Array.from(
          { length: parseInt(tokensLength.toString()) },
          (v, i) => i
        );
        const x_arry = Array.from(
          { length: parseInt(x_tokensLength.toString()) },
          (v, i) => i
        );
        const xx_arry = Array.from(
          { length: parseInt(xx_tokensLength.toString()) },
          (v, i) => i
        );

        const bribes = await Promise.all(
          arry.map(async (idx) => {
            const tokenAddress = await bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );
        const x_bribes = await Promise.all(
          x_arry.map(async (idx) => {
            const tokenAddress = await x_bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );
        const xx_bribes = await Promise.all(
          xx_arry.map(async (idx) => {
            const tokenAddress = await xx_bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );

        const weightPercent = (
          (Number(gaugeWeight) * 100) /
          Number(totalWeight)
        ).toFixed(2);

        thePair.gauge = {
          address: gaugeAddress,
          bribeAddress: bribeAddress,
          decimals: 18,
          balance: formatEther(gaugeBalance),
          totalSupply: formatEther(totalSupply),
          weight: formatEther(gaugeWeight),
          weightPercent,
          bribes: bribes,
          x_bribes: x_bribes,
          xx_bribes: xx_bribes,
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

  getPair = async (
    addressA: `0x${string}`,
    addressB: `0x${string}`,
    stab: boolean
  ) => {
    if (addressA === NATIVE_TOKEN.symbol) {
      addressA = W_NATIVE_ADDRESS as `0x${string}`;
    }
    if (addressB === NATIVE_TOKEN.symbol) {
      addressB = W_NATIVE_ADDRESS as `0x${string}`;
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
      const pc = {
        abi: CONTRACTS.PAIR_ABI,
        address: thePair[0].address,
      } as const;

      const [totalSupply, reserve0, reserve1, balanceOf] =
        await viemClient.multicall({
          allowFailure: false,
          multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
          contracts: [
            {
              ...pc,
              functionName: "totalSupply",
            },
            {
              ...pc,
              functionName: "reserve0",
            },
            {
              ...pc,
              functionName: "reserve1",
            },
            {
              ...pc,
              functionName: "balanceOf",
              args: [account.address],
            },
          ],
        });

      const returnPair = thePair[0];
      returnPair.balance = formatUnits(balanceOf, PAIR_DECIMALS);
      returnPair.totalSupply = formatUnits(totalSupply, PAIR_DECIMALS);
      returnPair.reserve0 = formatUnits(reserve0, returnPair.token0.decimals);
      returnPair.reserve1 = formatUnits(reserve1, returnPair.token1.decimals);

      return returnPair;
    }

    const factoryContract = getContract({
      abi: CONTRACTS.FACTORY_ABI,
      address: CONTRACTS.FACTORY_ADDRESS,
      publicClient: viemClient,
    });
    const pairAddress = await factoryContract.read.getPair([
      addressA,
      addressB,
      stab,
    ]);

    if (pairAddress && pairAddress != ZERO_ADDRESS) {
      const pairContract = {
        abi: CONTRACTS.PAIR_ABI,
        address: pairAddress,
      } as const;
      const gaugesContract = {
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
      } as const;

      const totalWeight = await viemClient.readContract({
        ...gaugesContract,
        functionName: "totalWeight",
      });

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
      ] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...pairContract,
            functionName: "token0",
          },
          {
            ...pairContract,
            functionName: "token1",
          },
          {
            ...pairContract,
            functionName: "totalSupply",
          },
          {
            ...pairContract,
            functionName: "symbol",
          },
          {
            ...pairContract,
            functionName: "reserve0",
          },
          {
            ...pairContract,
            functionName: "reserve1",
          },
          {
            ...pairContract,
            functionName: "decimals",
          },
          {
            ...pairContract,
            functionName: "balanceOf",
            args: [account.address],
          },
          {
            ...pairContract,
            functionName: "stable",
          },
          {
            ...gaugesContract,
            functionName: "gauges",
            args: [pairAddress],
          },
          {
            ...gaugesContract,
            functionName: "weights",
            args: [pairAddress],
          },
        ],
      });

      const token0Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: token0,
      } as const;

      const token1Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: token1,
      } as const;

      const [
        token0Symbol,
        token0Decimals,
        token0Balance,
        token1Symbol,
        token1Decimals,
        token1Balance,
      ] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...token0Contract,
            functionName: "symbol",
          },
          {
            ...token0Contract,
            functionName: "decimals",
          },
          {
            ...token0Contract,
            functionName: "balanceOf",
            args: [account.address],
          },
          {
            ...token1Contract,
            functionName: "symbol",
          },
          {
            ...token1Contract,
            functionName: "decimals",
          },
          {
            ...token1Contract,
            functionName: "balanceOf",
            args: [account.address],
          },
        ],
      });

      thePair = {
        address: pairAddress,
        symbol: symbol,
        decimals: decimals,
        stable,
        token0: {
          address: token0,
          symbol: token0Symbol,
          balance: formatUnits(
            token0Balance,
            parseInt(token0Decimals.toString())
          ),
          decimals: parseInt(token0Decimals.toString()),
        },
        token1: {
          address: token1,
          symbol: token1Symbol,
          balance: formatUnits(
            token1Balance,
            parseInt(token1Decimals.toString())
          ),
          decimals: parseInt(token1Decimals.toString()),
        },
        balance: formatUnits(balanceOf, decimals),
        totalSupply: formatUnits(totalSupply, decimals),
        reserve0: formatUnits(reserve0, parseInt(token0Decimals.toString())),
        reserve1: formatUnits(reserve1, parseInt(token1Decimals.toString())),
        tvl: 0,
      };

      if (gaugeAddress !== ZERO_ADDRESS) {
        const gaugeContract = {
          abi: CONTRACTS.GAUGE_ABI,
          address: gaugeAddress,
        } as const;
        //wrapped bribe address is coming from api. if the api doesnt work this will break
        const bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.wrapped_bribe_address,
        } as const;
        const bribeContractInstance = getContract({
          ...bribeContract,
          publicClient: viemClient,
        });
        const x_bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.x_wrapped_bribe_address,
        } as const;
        const x_bribeContractInstance = getContract({
          ...x_bribeContract,
          publicClient: viemClient,
        });
        const xx_bribeContract = {
          abi: CONTRACTS.BRIBE_ABI,
          address: thePair.gauge.xx_wrapped_bribe_address,
        } as const;
        const xx_bribeContractInstance = getContract({
          ...xx_bribeContract,
          publicClient: viemClient,
        });

        const [totalSupply, gaugeBalance, bribeAddress] =
          await viemClient.multicall({
            allowFailure: false,
            multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
            contracts: [
              {
                ...gaugeContract,
                functionName: "totalSupply",
              },
              {
                ...gaugeContract,
                functionName: "balanceOf",
                args: [account.address],
              },
              {
                ...gaugesContract,
                functionName: "external_bribes",
                args: [gaugeAddress],
              },
            ],
          });

        const tokensLength =
          await bribeContractInstance.read.rewardsListLength();
        const x_tokensLength =
          await x_bribeContractInstance.read.rewardsListLength();
        const xx_tokensLength =
          await xx_bribeContractInstance.read.rewardsListLength();

        const arry = Array.from(
          { length: parseInt(tokensLength.toString()) },
          (v, i) => i
        );
        const x_arry = Array.from(
          { length: parseInt(x_tokensLength.toString()) },
          (v, i) => i
        );
        const xx_arry = Array.from(
          { length: parseInt(xx_tokensLength.toString()) },
          (v, i) => i
        );

        const bribes = await Promise.all(
          arry.map(async (idx) => {
            const tokenAddress = await bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );
        const x_bribes = await Promise.all(
          x_arry.map(async (idx) => {
            const tokenAddress = await x_bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );
        const xx_bribes = await Promise.all(
          xx_arry.map(async (idx) => {
            const tokenAddress = await xx_bribeContractInstance.read.rewards([
              BigInt(idx),
            ]);

            const token = await this.getBaseAsset(tokenAddress);
            if (!token) {
              return null;
            }

            const rewardRate = await viemClient.readContract({
              ...gaugeContract,
              functionName: "rewardRate",
              args: [tokenAddress],
            });

            return {
              token: token,
              rewardAmount: formatUnits(
                rewardRate * BigInt(604800),
                token.decimals
              ),
            };
          })
        );

        const weightPercent = (
          (Number(gaugeWeight) * 100) /
          Number(totalWeight)
        ).toFixed(2);

        thePair.gauge = {
          address: gaugeAddress,
          bribeAddress: bribeAddress,
          decimals: 18,
          balance: formatEther(gaugeBalance),
          totalSupply: formatEther(totalSupply),
          weight: formatEther(gaugeWeight),
          weightPercent,
          bribes: bribes,
          x_bribes: x_bribes,
          xx_bribes: x_bribes,
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
    address: `0x${string}`,
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
      const baseAssetContract = {
        abi: CONTRACTS.ERC20_ABI,
        address: address,
      } as const;

      const [symbol, decimals, name] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...baseAssetContract,
            functionName: "symbol",
          },
          {
            ...baseAssetContract,
            functionName: "decimals",
          },
          {
            ...baseAssetContract,
            functionName: "name",
          },
        ],
      });

      const newBaseAsset: BaseAsset = {
        address: address,
        symbol: symbol,
        name: name,
        decimals: parseInt(decimals.toString()),
        logoURI: null,
        local: true,
        balance: null,
        isWhitelisted: undefined,
        listingFee: undefined,
      };

      if (getBalance) {
        const account = stores.accountStore.getStore("account");
        if (account) {
          const balanceOf = await viemClient.readContract({
            ...baseAssetContract,
            functionName: "balanceOf",
            args: [account.address],
          });
          newBaseAsset.balance = formatUnits(balanceOf, newBaseAsset.decimals);
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
      // this.setStore({ routeAssets: await this._getRouteAssets() }); // We dont need it because we use firebird router
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
      this.setStore({ tbv: pairsCall.tbv });

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

      this._getGovTokenInfo(account);
      await this._getBaseAssetInfo(account);
      await this._getPairInfo(account);
    } catch (ex) {
      console.log(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getVestNFTs = async (account: { address: `0x${string}` }) => {
    try {
      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        throw new Error("veToken or govToken not found");
      }

      const vestingContract = {
        abi: CONTRACTS.VE_TOKEN_ABI,
        address: CONTRACTS.VE_TOKEN_ADDRESS,
      } as const;

      const nftsLength = await viemClient.readContract({
        ...vestingContract,
        functionName: "balanceOf",
        args: [account.address],
      });

      const arr = Array.from(
        { length: parseInt(nftsLength.toString()) },
        (v, i) => i
      );

      const nfts: VestNFT[] = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await viemClient.readContract({
            ...vestingContract,
            functionName: "tokenOfOwnerByIndex",
            args: [account.address, BigInt(idx)],
          });
          const [[lockedAmount, lockedEnd], lockValue, voted] =
            await viemClient.multicall({
              allowFailure: false,
              multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
              contracts: [
                {
                  ...vestingContract,
                  functionName: "locked",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "balanceOfNFT",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "voted",
                  args: [tokenIndex],
                },
              ],
            });

          const [actionedInCurrentEpoch, lastVoted] =
            await this._checkNFTActionEpoch(tokenIndex.toString());

          // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
          return {
            id: tokenIndex.toString(),
            lockEnds: lockedEnd.toString(),
            lockAmount: formatUnits(lockedAmount, govToken.decimals),
            lockValue: formatUnits(lockValue, veToken.decimals),
            actionedInCurrentEpoch,
            reset: actionedInCurrentEpoch && !voted,
            lastVoted,
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

  _getGovTokenInfo = async (account: { address: `0x${string}` }) => {
    try {
      const govToken = this.getStore("govToken");
      if (!govToken) {
        console.warn("govToken not found");
        return null;
      }

      const balanceOf = await viemClient.readContract({
        abi: CONTRACTS.GOV_TOKEN_ABI,
        address: CONTRACTS.GOV_TOKEN_ADDRESS,
        functionName: "balanceOf",
        args: [account.address],
      });

      govToken.balanceOf = balanceOf.toString();
      govToken.balance = formatUnits(balanceOf, govToken.decimals);

      this.setStore({ govToken });
      this.emitter.emit(ACTIONS.UPDATED);

      this._getVestNFTs(account);
    } catch (ex) {
      console.log(ex);
    }
  };

  _getPairInfo = async (
    account: { address: `0x${string}` },
    overridePairs?: Pair[]
  ) => {
    try {
      let pairs: Pair[] = [];

      if (overridePairs) {
        pairs = overridePairs;
      } else {
        pairs = this.getStore("pairs");
      }

      const gaugesContract = {
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
      } as const;

      const totalWeight = await viemClient.readContract({
        ...gaugesContract,
        functionName: "totalWeight",
      });

      const pairCalls = pairs.flatMap((pair) => {
        return [
          {
            address: pair.address,
            abi: CONTRACTS.PAIR_ABI,
            functionName: "totalSupply",
          },
          {
            address: pair.address,
            abi: CONTRACTS.PAIR_ABI,
            functionName: "reserve0",
          },
          {
            address: pair.address,
            abi: CONTRACTS.PAIR_ABI,
            functionName: "reserve1",
          },
          {
            address: pair.address,
            abi: CONTRACTS.PAIR_ABI,
            functionName: "balanceOf",
            args: [account.address],
          },
        ] as const;
      });
      const pairCallsChunks = chunkArray(pairCalls, 100);
      const pairsData = await multicallChunks(pairCallsChunks);

      const ps = await Promise.all(
        pairs.map(async (pair, i) => {
          try {
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

            const [totalSupply, reserve0, reserve1, balanceOf] =
              pairsData.slice(i * 4, i * 4 + 4);

            pair.token0 = token0 != null ? token0 : pair.token0;
            pair.token1 = token1 != null ? token1 : pair.token1;
            pair.balance = formatUnits(balanceOf, PAIR_DECIMALS);
            pair.totalSupply = formatUnits(totalSupply, PAIR_DECIMALS);
            pair.reserve0 = formatUnits(reserve0, pair.token0.decimals);
            pair.reserve1 = formatUnits(reserve1, pair.token1.decimals);

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

      const gauges = ps.filter(hasGauge);

      const gaugesAliveCalls = gauges.map((pair) => {
        return {
          ...gaugesContract,
          functionName: "isAlive",
          args: [pair.gauge.address],
        } as const;
      });
      const gaugesAliveCallsChunks = chunkArray(gaugesAliveCalls);
      const gaugesAliveData = await multicallChunks(gaugesAliveCallsChunks);

      const gaugesCalls = gauges.flatMap((pair) => {
        return [
          {
            address: pair.gauge.address,
            abi: CONTRACTS.GAUGE_ABI,
            functionName: "totalSupply",
          },
          {
            address: pair.gauge.address,
            abi: CONTRACTS.GAUGE_ABI,
            functionName: "balanceOf",
            args: [account.address],
          },
          {
            ...gaugesContract,
            functionName: "weights",
            args: [pair.address],
          },
        ] as const;
      });
      const gaugesCallsChunks = chunkArray(gaugesCalls);
      const gaugesData = await multicallChunks(gaugesCallsChunks);

      const bribesReservesCalls = gauges.flatMap((pair) =>
        pair.gauge.bribes.map(
          (bribe) =>
            ({
              address: bribe.token.address,
              abi: CONTRACTS.ERC20_ABI,
              functionName: "balanceOf",
              args: [pair.gauge.wrapped_bribe_address],
            } as const)
        )
      );
      const bribesReservesChunks = chunkArray(bribesReservesCalls, 100);

      const bribesReservesData = await multicallChunks(bribesReservesChunks);

      gauges.forEach((pair) => {
        const bribesReservesPair = bribesReservesData.splice(
          0,
          pair.gauge.bribes.length
        );
        pair.gauge.bribeReserve = pair.gauge.bribes.map((bribe, i) => {
          return formatUnits(bribesReservesPair[i], bribe.token.decimals);
        });
      });

      // this is to increment index only if pair hasGauge
      let outerIndex = 0;
      const ps1 = ps.map((pair) => {
        try {
          if (hasGauge(pair)) {
            const isAliveGauge = gaugesAliveData[outerIndex];

            const [totalSupply, gaugeBalance, gaugeWeight] = gaugesData.slice(
              outerIndex * 3,
              outerIndex * 3 + 3
            );

            const bribes = pair.gauge.bribes.map((bribe) => {
              bribe.rewardAmount = bribe.rewardAmmount;
              return bribe;
            });
            pair.gauge.x_bribes.forEach((x_bribe) => {
              const bribe = bribes.find(
                (b) => b.token.address === x_bribe.token.address
              );
              if (bribe) {
                bribe.rewardAmount =
                  bribe.rewardAmmount + x_bribe.rewardAmmount;
              } else {
                bribes.push({
                  token: x_bribe.token,
                  rewardAmount: x_bribe.rewardAmmount,
                  reward_ammount: x_bribe.rewardAmmount,
                  rewardAmmount: x_bribe.rewardAmmount,
                });
              }
            });
            pair.gauge.xx_bribes.forEach((xx_bribe) => {
              const bribe = bribes.find(
                (b) => b.token.address === xx_bribe.token.address
              );
              if (bribe) {
                bribe.rewardAmount =
                  bribe.rewardAmmount + xx_bribe.rewardAmmount;
              } else {
                bribes.push({
                  token: xx_bribe.token,
                  rewardAmount: xx_bribe.rewardAmmount,
                  reward_ammount: xx_bribe.rewardAmmount,
                  rewardAmmount: xx_bribe.rewardAmmount,
                });
              }
            });

            pair.gauge.balance = formatEther(gaugeBalance);
            pair.gauge.totalSupply = formatEther(totalSupply);

            // in ps totalSupply for reassgined to string from number (api sends number)
            pair.gauge.reserve0 =
              parseFloat(pair.totalSupply as `${number}`) > 0
                ? BigNumber(pair.reserve0)
                    .times(pair.gauge.totalSupply)
                    .div(pair.totalSupply)
                    .toFixed(pair.token0.decimals)
                : "0";
            // in ps totalSupply for reassgined to string from number (api sends number)
            pair.gauge.reserve1 =
              parseFloat(pair.totalSupply as `${number}`) > 0
                ? BigNumber(pair.reserve1)
                    .times(pair.gauge.totalSupply)
                    .div(pair.totalSupply)
                    .toFixed(pair.token1.decimals)
                : "0";
            pair.gauge.weight = formatEther(gaugeWeight);
            pair.gauge.weightPercent = (
              (Number(gaugeWeight) * 100) /
              Number(totalWeight)
            ).toFixed(2);
            // NOTE: this is being used in votes table to show aggregated bribes and x_bribes
            pair.gaugebribes = bribes;
            pair.isAliveGauge = isAliveGauge;
            if (isAliveGauge === false) pair.apr = 0;

            outerIndex++;
          }

          return pair;
        } catch (ex) {
          console.log("EXCEPTION 2");
          console.log(pair);
          console.log(ex);
          return pair;
        }
      });

      this.setStore({ pairs: ps1 });
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.log(ex);
    }
  };

  _getBaseAssetInfo = async (account: { address: `0x${string}` }) => {
    try {
      const baseAssets = this.getStore("baseAssets");
      if (!baseAssets) {
        console.warn("baseAssets not found");
        return null;
      }

      const voterContract = {
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
      } as const;

      let baseAssetsWithBalances: BaseAsset[] = [];

      const nativeToken = baseAssets.find(
        (asset) => asset.address === NATIVE_TOKEN.symbol
      );
      if (nativeToken) {
        const balance = await viemClient.getBalance({
          address: account.address,
        });
        baseAssetsWithBalances.push({
          ...nativeToken,
          balance: formatUnits(balance, nativeToken.decimals),
          isWhitelisted: true,
        } as const);
      }

      const baseAssetsWithoutNativeToken = baseAssets
        .map((asset) => {
          if (asset.address !== NATIVE_TOKEN.symbol) {
            return asset;
          }
        })
        .filter((asset): asset is BaseAsset => asset !== undefined);
      if (baseAssetsWithoutNativeToken.length === 0) {
        console.warn("error in base assets logic");
        return null;
      }

      const baseAssetsWhitelistedCalls = baseAssetsWithoutNativeToken.map(
        (asset) => {
          return {
            ...voterContract,
            functionName: "isWhitelisted",
            args: [asset.address],
          } as const;
        }
      );

      const baseAssetsBalancesCalls = baseAssetsWithoutNativeToken.map(
        (asset) => {
          return {
            abi: CONTRACTS.ERC20_ABI,
            address: asset.address,
            functionName: "balanceOf",
            args: [account.address],
          } as const;
        }
      );

      const whitelistedCallsChunks = chunkArray(baseAssetsWhitelistedCalls);
      const baseAssetsWhitelistedResults = await multicallChunks(
        whitelistedCallsChunks
      );

      const balancesCallsChunks = chunkArray(baseAssetsBalancesCalls);
      const baseAssetsBalancesResults = await multicallChunks(
        balancesCallsChunks
      );

      for (let i = 0; i < baseAssetsWithoutNativeToken.length; i++) {
        baseAssetsWithBalances.push({
          ...baseAssetsWithoutNativeToken[i],
          balance: formatUnits(
            baseAssetsBalancesResults[i],
            baseAssetsWithoutNativeToken[i].decimals
          ),
          isWhitelisted: baseAssetsWhitelistedResults[i],
        });
      }
      baseAssets.forEach((baseAsset) => {
        const baseAssetWithBalance = baseAssetsWithBalances.find(
          (baseAssetWithBalance) =>
            baseAssetWithBalance.address === baseAsset.address
        );
        if (baseAssetWithBalance) {
          baseAsset.balance = baseAssetWithBalance.balance;
          baseAsset.isWhitelisted = baseAssetWithBalance.isWhitelisted;
        }
      });

      this.setStore({ baseAssets: baseAssetsWithBalances });
      this.updateSwapAssets(baseAssetsWithBalances);
      this.emitter.emit(ACTIONS.UPDATED);
    } catch (ex) {
      console.log(ex);
    }
  };

  searchBaseAsset = async (payload: {
    type: string;
    content: { address: `0x${string}` };
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

      const baseAssetContract = {
        abi: CONTRACTS.ERC20_ABI,
        address: payload.content.address,
      } as const;

      const [symbol, decimals, name] = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: [
          {
            ...baseAssetContract,
            functionName: "symbol",
          },
          {
            ...baseAssetContract,
            functionName: "decimals",
          },
          {
            ...baseAssetContract,
            functionName: "name",
          },
        ],
      });

      const newBaseAsset: BaseAsset = {
        address: payload.content.address,
        symbol: symbol,
        name: name,
        decimals: parseInt(decimals.toString()),
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
        toki0 = W_NATIVE_ADDRESS as `0x${string}`;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        toki1 = W_NATIVE_ADDRESS as `0x${string}`;
      }

      const factoryContract = new web3.eth.Contract(
        CONTRACTS.FACTORY_ABI as unknown as AbiItem[],
        CONTRACTS.FACTORY_ADDRESS
      );
      const pairFor = await factoryContract.methods
        .getPair(toki0, toki1, stable)
        .call();

      if (pairFor && pairFor != ZERO_ADDRESS) {
        await context.updatePairsCall(account);
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
        allowance0 = await this._getDepositAllowance(token0, account);
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
        allowance1 = await this._getDepositAllowance(token1, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
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
            tok0 = W_NATIVE_ADDRESS as `0x${string}`;
          }
          if (token1.address === NATIVE_TOKEN.symbol) {
            tok1 = W_NATIVE_ADDRESS as `0x${string}`;
          }
          const pairFor = await factoryContract.methods
            .getPair(tok0, tok1, stable)
            .call();

          // SUBMIT CREATE GAUGE TRANSACTION
          const gaugesContract = new web3.eth.Contract(
            CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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
                CONTRACTS.PAIR_ABI as unknown as AbiItem[],
                pairFor
              );
              const gaugeContract = new web3.eth.Contract(
                CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
                gaugeAddress
              );

              const balanceOf = await pairContract.methods
                .balanceOf(account.address)
                .call();
              // FIXME this throws and pair is null for some reason (fork issue? fe issue?)
              const pair = await this.getPairByAddress(pairFor);
              const stakeAllowance = await this._getStakeAllowance(
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

                  await context.updatePairsCall(account);

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
        toki0 = W_NATIVE_ADDRESS as `0x${string}`;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        toki1 = W_NATIVE_ADDRESS as `0x${string}`;
      }

      const factoryContract = new web3.eth.Contract(
        CONTRACTS.FACTORY_ABI as unknown as AbiItem[],
        CONTRACTS.FACTORY_ADDRESS
      );
      const pairFor = await factoryContract.methods
        .getPair(toki0, toki1, stable)
        .call();

      if (pairFor && pairFor != ZERO_ADDRESS) {
        await context.updatePairsCall(account);
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
        allowance0 = await this._getDepositAllowance(token0, account);
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
        allowance1 = await this._getDepositAllowance(token1, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
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
            tok0 = W_NATIVE_ADDRESS as `0x${string}`;
          }
          if (token1.address === NATIVE_TOKEN.symbol) {
            tok1 = W_NATIVE_ADDRESS as `0x${string}`;
          }
          const pairFor = await factoryContract.methods
            .getPair(tok0, tok1, stable)
            .call();

          // SUBMIT CREATE GAUGE TRANSACTION
          const gaugesContract = new web3.eth.Contract(
            CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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

              await context.updatePairsCall(account);

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

  updatePairsCall = async (account: { address: `0x${string}` }) => {
    try {
      // update pairs is same endpoint in API. Pairs are updated in sync on backend
      const response = await fetch(`/api/pairs`);
      const pairsCall = await response.json();
      this.setStore({ pairs: pairsCall.data });

      await this._getPairInfo(account, pairsCall.data);
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
        allowance0 = await this._getDepositAllowance(token0, account);
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
        allowance1 = await this._getDepositAllowance(token1, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
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

          this._getPairInfo(account);

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
    content: { pair: Gauge; token: any };
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

      const stakeAllowance = await this._getStakeAllowance(pair, account);
      if (!stakeAllowance) throw new Error("Error getting stake allowance");

      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as unknown as AbiItem[],
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
        CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
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

          this._getPairInfo(account);

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
      pair: Gauge;
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
        allowance0 = await this._getDepositAllowance(token0, account);
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
        allowance1 = await this._getDepositAllowance(token1, account);
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

      const stakeAllowance = await this._getStakeAllowance(pair, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
        pair.gauge.address
      );
      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as unknown as AbiItem[],
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

              this._getPairInfo(account);

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
    token: BaseAsset,
    account: { address: `0x${string}` }
  ) => {
    try {
      const allowance = await viemClient.readContract({
        address: token.address,
        abi: CONTRACTS.ERC20_ABI,
        functionName: "allowance",
        args: [account.address, CONTRACTS.ROUTER_ADDRESS],
      });

      return formatUnits(allowance, token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getStakeAllowance = async (
    pair: Gauge,
    account: { address: `0x${string}` },
    pairAddress?: `0x${string}`
  ) => {
    try {
      let tokenContract;
      if (pair === null && !!pairAddress) {
        tokenContract = {
          abi: CONTRACTS.ERC20_ABI,
          address: pairAddress,
        } as const;
      } else {
        tokenContract = {
          abi: CONTRACTS.ERC20_ABI,
          address: pair.address,
        } as const;
      }
      const allowance = await viemClient.readContract({
        ...tokenContract,
        functionName: "allowance",
        args: [account.address, pair.gauge.address],
      });

      return formatUnits(allowance, PAIR_DECIMALS);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  _getWithdrawAllowance = async (
    pair: Pair,
    account: { address: `0x${string}` }
  ) => {
    try {
      const allowance = await viemClient.readContract({
        address: pair.address,
        abi: CONTRACTS.ERC20_ABI,
        functionName: "allowance",
        args: [account.address, CONTRACTS.ROUTER_ADDRESS],
      });

      return formatUnits(allowance, PAIR_DECIMALS);
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
      amount0: `${number}` | "";
      amount1: `${number}` | "";
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const { pair, token0, token1, amount0, amount1 } = payload.content;

      if (!pair || !token0 || !token1 || amount0 == "" || amount1 == "") {
        return null;
      }

      const sendAmount0 = parseUnits(amount0, token0.decimals);
      const sendAmount1 = parseUnits(amount1, token1.decimals);

      let addy0 = token0.address;
      let addy1 = token1.address;

      if (token0.address === NATIVE_TOKEN.symbol) {
        addy0 = W_NATIVE_ADDRESS as `0x${string}`;
      }
      if (token1.address === NATIVE_TOKEN.symbol) {
        addy1 = W_NATIVE_ADDRESS as `0x${string}`;
      }

      const [_amountA, _amountB, liquidity] = await viemClient.readContract({
        address: CONTRACTS.ROUTER_ADDRESS,
        abi: CONTRACTS.ROUTER_ABI,
        functionName: "quoteAddLiquidity",
        args: [addy0, addy1, pair.stable, sendAmount0, sendAmount1],
      });

      const returnVal = {
        inputs: {
          token0,
          token1,
          amount0,
          amount1,
        },
        output: formatUnits(liquidity, PAIR_DECIMALS),
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

      const { pair } = payload.content;

      if (!pair) {
        return;
      }

      const token0Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: pair.token0.address,
      } as const;
      const token1Contract = {
        abi: CONTRACTS.ERC20_ABI,
        address: pair.token1.address,
      } as const;
      const pairContract = {
        abi: CONTRACTS.ERC20_ABI,
        address: pair.address,
      } as const;

      const balanceCalls = [
        {
          ...token0Contract,
          functionName: "balanceOf",
          args: [account.address],
        },
        {
          ...token1Contract,
          functionName: "balanceOf",
          args: [account.address],
        },
        {
          ...pairContract,
          functionName: "balanceOf",
          args: [account.address],
        },
      ] as const;

      const [token0Balance, token1Balance, poolBalance] =
        await viemClient.multicall({
          allowFailure: false,
          multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
          contracts: balanceCalls,
        });

      const returnVal: {
        token0: string;
        token1: string;
        pool: string;
        gauge: string | null;
      } = {
        token0: formatUnits(token0Balance, pair.token0.decimals),
        token1: formatUnits(token1Balance, pair.token1.decimals),
        pool: formatEther(poolBalance),
        gauge: null,
      };

      let gaugeBalance;
      if (pair.gauge) {
        gaugeBalance = await viemClient.readContract({
          address: pair.gauge.address,
          abi: CONTRACTS.ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        });
      }

      if (pair.gauge) {
        returnVal.gauge = gaugeBalance ? formatEther(gaugeBalance) : null;
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
      const allowance = await this._getWithdrawAllowance(pair, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
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

          this._getPairInfo(account);

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
      const allowance = await this._getWithdrawAllowance(pair, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.ROUTER_ABI as unknown as AbiItem[],
        CONTRACTS.ROUTER_ADDRESS
      );
      const gaugeContract = new web3.eth.Contract(
        CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
        pair.gauge?.address
      );
      const pairContract = new web3.eth.Contract(
        CONTRACTS.PAIR_ABI as unknown as AbiItem[],
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

              this._getPairInfo(account);

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
        CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
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

          this._getPairInfo(account);

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
      withdrawAmount: `${number}` | "";
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const { pair, token0, token1, withdrawAmount } = payload.content;

      if (!pair || !token0 || !token1 || withdrawAmount == "") {
        return null;
      }

      const routerContract = {
        abi: CONTRACTS.ROUTER_ABI,
        address: CONTRACTS.ROUTER_ADDRESS,
      } as const;

      const sendWithdrawAmount = parseEther(withdrawAmount);

      const [amountA, amountB] = await viemClient.readContract({
        ...routerContract,
        functionName: "quoteRemoveLiquidity",
        args: [token0.address, token1.address, pair.stable, sendWithdrawAmount],
      });

      const returnVal = {
        inputs: {
          token0,
          token1,
          withdrawAmount,
        },
        output: {
          amount0: formatUnits(amountA, token0.decimals),
          amount1: formatUnits(amountB, token1.decimals),
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
        CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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

          await this.updatePairsCall(account);

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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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

        this._getSpecificAssetInfo(account, fromAsset.address);
        this._getSpecificAssetInfo(account, toAsset.address); // TODO use this instead of get balances dispatch?
        this._getPairInfo(account);

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
        W_NATIVE_ABI as unknown as AbiItem[],
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

          this._getSpecificAssetInfo(account, fromAsset.address);
          this._getSpecificAssetInfo(account, toAsset.address);

          this.emitter.emit(ACTIONS.WRAP_UNWRAP_RETURNED);
        },
        sendValue
      );
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getSpecificAssetInfo = async (
    account: { address: `0x${string}` },
    assetAddress: `0x${string}`
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
              let bal = await viemClient.getBalance({
                address: account.address,
              });
              asset.balance = formatUnits(bal, asset.decimals);
            } else {
              const balanceOf = await viemClient.readContract({
                address: asset.address,
                abi: CONTRACTS.ERC20_ABI,
                functionName: "balanceOf",
                args: [account.address],
              });

              asset.balance = formatUnits(balanceOf, asset.decimals);
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
    token: BaseAsset,
    account: { address: `0x${string}` },
    quote: QuoteSwapResponse
  ) => {
    try {
      const allowance = await viemClient.readContract({
        address: token.address,
        abi: CONTRACTS.ERC20_ABI,
        functionName: "allowance",
        args: [account.address, quote.encodedData.router],
      });

      return formatUnits(allowance, token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
    }
  };

  // _getSwapAllowance = async (
  //   token: BaseAsset,
  //   account: { address: string }
  // ) => {
  //   try {
  //     const allowance = await viemClient.readContract({
  //       address: token.address ,
  //       abi: CONTRACTS.ERC20_ABI,
  //       functionName: "allowance",
  //       args: [account.address , CONTRACTS.ROUTER_ADDRESS],
  //     });

  //     return formatUnits(allowance, token.decimals);
  //   } catch (ex) {
  //     console.error(ex);
  //     return null;
  //   }
  // };

  getVestNFTs = async () => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken) {
        throw new Error("veToken or govToken not found");
      }

      const vestingContract = {
        abi: CONTRACTS.VE_TOKEN_ABI,
        address: CONTRACTS.VE_TOKEN_ADDRESS,
      } as const;

      const nftsLength = await viemClient.readContract({
        ...vestingContract,
        functionName: "balanceOf",
        args: [account.address],
      });

      const arr = Array.from(
        { length: parseInt(nftsLength.toString()) },
        (v, i) => i
      );

      const nfts = await Promise.all(
        arr.map(async (idx) => {
          const tokenIndex = await viemClient.readContract({
            ...vestingContract,
            functionName: "tokenOfOwnerByIndex",
            args: [account.address, BigInt(idx)] as const,
          });

          const [[lockedAmount, lockedEnd], lockValue, voted] =
            await viemClient.multicall({
              allowFailure: false,
              multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
              contracts: [
                {
                  ...vestingContract,
                  functionName: "locked",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "balanceOfNFT",
                  args: [tokenIndex],
                },
                {
                  ...vestingContract,
                  functionName: "voted",
                  args: [tokenIndex],
                },
              ],
            });

          const [actionedInCurrentEpoch, lastVoted] =
            await this._checkNFTActionEpoch(tokenIndex.toString());

          // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
          return {
            id: tokenIndex.toString(),
            lockEnds: lockedEnd.toString(),
            lockAmount: formatUnits(lockedAmount, govToken.decimals),
            lockValue: formatUnits(lockValue, veToken.decimals),
            actionedInCurrentEpoch,
            reset: actionedInCurrentEpoch && !voted,
            lastVoted,
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
      const allowance = await this._getVestAllowance(govToken, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
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

          this._getGovTokenInfo(account);
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
    token: GovToken,
    account: { address: `0x${string}` }
  ) => {
    try {
      const allowance = await viemClient.readContract({
        address: token.address,
        abi: CONTRACTS.ERC20_ABI,
        functionName: "allowance",
        args: [account.address, CONTRACTS.VE_TOKEN_ADDRESS],
      });

      return formatUnits(allowance, token.decimals);
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
      const allowance = await this._getVestAllowance(govToken, account);
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
          CONTRACTS.ERC20_ABI as unknown as AbiItem[],
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
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
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

          this._getGovTokenInfo(account);
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
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
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
      const signer = await stores.accountStore.getEthersSigner();
      if (!signer) {
        console.warn("signer not found");
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

      const voterContract = wGetContract({
        address: CONTRACTS.VOTER_ADDRESS,
        abi: CONTRACTS.VOTER_ABI,
        signerOrProvider: signer,
      });

      if (rewards.bribes.length > 0) {
        const sendGauges = rewards.bribes.map((pair) => {
          return pair.gauge?.wrapped_bribe_address;
        });
        const sendTokens = rewards.bribes.map((pair) => {
          return pair.gauge?.bribesEarned?.map((bribe) => {
            return (bribe as Bribe).token.address;
          });
        });

        const tx = await voterContract.claimBribes(
          sendGauges,
          sendTokens as `0x${string}`[][],
          ethers.BigNumber.from(tokenID)
        );

        if (tx.hash) {
          this.emitter.emit(ACTIONS.TX_SUBMITTED, {
            uuid: rewardsTXID,
            txHash: tx.hash,
          });
        }

        const rec = await tx.wait(1);

        if (rec.transactionHash) {
          this.emitter.emit(ACTIONS.TX_CONFIRMED, {
            uuid: rewardsTXID,
            txHash: rec.transactionHash,
          });
        }
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
        const veDistContract = wGetContract({
          abi: CONTRACTS.VE_DIST_ABI,
          address: CONTRACTS.VE_DIST_ADDRESS,
          signerOrProvider: signer,
        });

        const tx = await veDistContract.claim(ethers.BigNumber.from(tokenID));

        if (tx.hash) {
          this.emitter.emit(ACTIONS.TX_SUBMITTED, {
            uuid: rebaseTXID,
            txHash: tx.hash,
          });
        }

        const rec = await tx.wait(1);

        if (rec.transactionHash) {
          this.emitter.emit(ACTIONS.TX_CONFIRMED, {
            uuid: rebaseTXID,
            txHash: rec.transactionHash,
          });
        }
      }

      const tx = await voterContract.reset(ethers.BigNumber.from(tokenID));

      if (tx.hash) {
        this.emitter.emit(ACTIONS.TX_SUBMITTED, {
          uuid: resetTXID,
          txHash: tx.hash,
        });
      }

      const rec = await tx.wait(1);

      if (rec.transactionHash) {
        this.emitter.emit(ACTIONS.TX_CONFIRMED, {
          uuid: resetTXID,
          txHash: rec.transactionHash,
        });
        this._updateVestNFTByID(tokenID);
        this.emitter.emit(ACTIONS.RESET_VEST_RETURNED);
      }
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
      let rewards01TXID = this.getTXUUID();
      let rewards0TXID = this.getTXUUID();
      let rewardsTXID = this.getTXUUID();
      let resetTXID = this.getTXUUID();
      let vestTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Withdraw vest amount on token #${tokenID}`,
        type: "Vest",
        verb: "Vest Withdrawn",
        transactions: [
          {
            uuid: rewards01TXID,
            description: `Checking unclaimed bribes`,
            status: "WAITING",
          },
          {
            uuid: rewards0TXID,
            description: `Checking unclaimed bribes`,
            status: "WAITING",
          },
          {
            uuid: rewardsTXID,
            description: `Checking unclaimed bribes`,
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

      if (rewards.xxBribes.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewards01TXID,
          description: `Unclaimed bribes found, claiming`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewards01TXID,
          description: `No unclaimed bribes found`,
          status: "DONE",
        });
      }
      if (rewards.xBribes.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewards0TXID,
          description: `Unclaimed bribes found, claiming`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: rewards0TXID,
          description: `No unclaimed bribes found`,
          status: "DONE",
        });
      }
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

      if (rewards.xxBribes.length > 0) {
        const sendGauges = rewards.xxBribes.map((pair) => {
          return pair.gauge?.xx_wrapped_bribe_address;
        });
        const sendTokens = rewards.xxBribes.map((pair) => {
          return pair.gauge?.xx_bribesEarned?.map((bribe) => {
            return (bribe as Bribe).token.address;
          });
        });

        const voterContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            voterContract,
            "claimBribes",
            [sendGauges, sendTokens, tokenID],
            account,
            rewards01TXID,
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
      if (rewards.xBribes.length > 0) {
        const sendGauges = rewards.xBribes.map((pair) => {
          return pair.gauge?.x_wrapped_bribe_address;
        });
        const sendTokens = rewards.xBribes.map((pair) => {
          return pair.gauge?.x_bribesEarned?.map((bribe) => {
            return (bribe as Bribe).token.address;
          });
        });

        const voterContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          this._callContractWait(
            voterContract,
            "claimBribes",
            [sendGauges, sendTokens, tokenID],
            account,
            rewards0TXID,
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
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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

      // CHECK if veNFT has votes
      const voted = await this._checkNFTVoted(tokenID);

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
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
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

  mergeNft = async (payload: {
    type: string;
    content: { from: string; to: string };
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
      const { from, to } = payload.content;

      let mergeTXID = this.getTXUUID();
      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Merge NFT #${from} into #${to}`,
        verb: "NFT Merged",
        transactions: [
          {
            uuid: mergeTXID,
            description: `Merging NFT #${from} into #${to}`,
            status: "WAITING",
          },
        ],
      });

      const votingEscrowContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );
      this._callContractWait(
        votingEscrowContract,
        "merge",
        [from, to],
        account,
        mergeTXID,
        (err) => {
          if (err) {
            return this.emitter.emit(ACTIONS.ERROR, err);
          }
          this.emitter.emit(ACTIONS.MERGE_NFT_RETURNED);
        }
      );
    } catch (e) {
      console.log(e);
      this.emitter.emit(ACTIONS.ERROR, e);
    }
  };

  // actioned in current epoch
  // either vote or reset, not both
  // reset would update lastVoted value as well
  _checkNFTActionEpoch = async (tokenID: string) => {
    const _lastVoted = await this._checkNFTLastVoted(tokenID);

    // if last voted eq 0, means never voted
    if (_lastVoted === BigInt("0")) return [false, _lastVoted] as const;
    const lastVoted = parseInt(_lastVoted.toString());

    let nextEpochTimestamp = this.getStore("updateDate");
    // if user goes straight to vest page, updateDate maybe not set yet
    if (nextEpochTimestamp === 0) {
      nextEpochTimestamp = await stores.helper.getActivePeriod();
    }

    // 7 days epoch length
    const actionedInCurrentEpoch =
      lastVoted > nextEpochTimestamp - 7 * 24 * 60 * 60;
    return [actionedInCurrentEpoch, _lastVoted] as const;
  };

  _checkNFTLastVoted = async (tokenID: string) => {
    const _lastVoted = await viemClient.readContract({
      address: CONTRACTS.VOTER_ADDRESS,
      abi: CONTRACTS.VOTER_ABI,
      functionName: "lastVoted",
      args: [BigInt(tokenID)],
    });
    return _lastVoted;
  };

  _checkNFTVoted = async (tokenID: string) => {
    const voted = await viemClient.readContract({
      address: CONTRACTS.VE_TOKEN_ADDRESS,
      abi: CONTRACTS.VE_TOKEN_ABI,
      functionName: "voted",
      args: [BigInt(tokenID)],
    });

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

      const signer = stores.accountStore.getEthersSigner();
      if (!signer) {
        console.warn("signer not found");
        return null;
      }

      // const govToken = this.getStore("govToken");
      const { tokenID, votes } = payload.content;

      // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
      let bribesTXID = this.getTXUUID();
      let voteTXID = this.getTXUUID();

      this.emitter.emit(ACTIONS.TX_ADDED, {
        title: `Cast vote using token #${tokenID}`,
        verb: "Votes Cast",
        transactions: [
          {
            uuid: bribesTXID,
            description: `Check unclaimed bribes`,
            status: "WAITING",
          },
          {
            uuid: voteTXID,
            description: `Cast votes`,
            status: "WAITING",
          },
        ],
      });

      const pairs = this.getStore("pairs");
      let deadGauges: string[] = [];

      // CHECK unclaimed bribes
      await this.getRewardBalances({ type: "internal", content: { tokenID } });
      const rewards = this.getStore("rewards");

      if (rewards.bribes.length > 0) {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: bribesTXID,
          description: `Unclaimed bribes found, claiming`,
        });
      } else {
        this.emitter.emit(ACTIONS.TX_STATUS, {
          uuid: bribesTXID,
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

        const voterContract = wGetContract({
          address: CONTRACTS.VOTER_ADDRESS,
          abi: CONTRACTS.VOTER_ABI,
          signerOrProvider: signer,
        });

        const tx = await voterContract.claimBribes(
          sendGauges,
          sendTokens as `0x${string}`[][],
          ethers.BigNumber.from(tokenID)
        );

        if (tx.hash) {
          this.emitter.emit(ACTIONS.TX_SUBMITTED, {
            uuid: bribesTXID,
            txHash: tx.hash,
          });
        }

        const rec = await tx.wait(1);

        if (rec.transactionHash) {
          this.emitter.emit(ACTIONS.TX_CONFIRMED, {
            uuid: bribesTXID,
            txHash: rec.transactionHash,
          });
        }
      }

      // SUBMIT INCREASE TRANSACTION
      const gaugesContract = wGetContract({
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
        signerOrProvider: signer,
      });

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

      let voteCountsEthersBigNumbers = voteCounts.map((voteCount) =>
        ethers.BigNumber.from(voteCount)
      );

      const tx = await gaugesContract.vote(
        ethers.BigNumber.from(tokenID),
        tokens,
        voteCountsEthersBigNumbers
      );

      if (tx.hash) {
        this.emitter.emit(ACTIONS.TX_SUBMITTED, {
          uuid: voteTXID,
          txHash: tx.hash,
        });
      }

      const rec = await tx.wait(1);

      if (rec.transactionHash) {
        this.emitter.emit(ACTIONS.TX_CONFIRMED, {
          uuid: voteTXID,
          txHash: rec.transactionHash,
        });
      }
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

      const gaugesContract = {
        abi: CONTRACTS.VOTER_ABI,
        address: CONTRACTS.VOTER_ADDRESS,
      } as const;

      const calls = filteredPairs.map((pair) => {
        return {
          ...gaugesContract,
          functionName: "votes",
          args: [BigInt(tokenID), pair.address],
        } as const;
      });

      const voteCounts = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: calls,
      });

      let votes: Vote[] = [];

      const totalVotes = voteCounts.reduce((curr, acc) => {
        let num = acc > 0 ? acc : acc * BigInt(-1);
        return curr + num;
      }, BigInt(0));

      for (let i = 0; i < voteCounts.length; i++) {
        votes.push({
          address: filteredPairs[i].address,
          votePercent:
            totalVotes > 0 || totalVotes < 0
              ? parseFloat(
                  ((voteCounts[i] * BigInt(100)) / totalVotes).toString()
                ).toFixed(0)
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
    content: { asset: BaseAsset; amount: string; gauge: Gauge };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const signer = stores.accountStore.getEthersSigner();
      if (!signer) {
        console.warn("signer not found");
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
      const allowance = await this._getBribeAllowance(asset, gauge, account);
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

      // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
      if (BigNumber(allowance).lt(amount)) {
        const tokenContract = wGetContract({
          abi: CONTRACTS.ERC20_ABI,
          address: asset.address,
          signerOrProvider: signer,
        });

        await tokenContract.approve(
          gauge.gauge?.xx_wrapped_bribe_address,
          ethers.BigNumber.from(MAX_UINT256)
        );
      }

      // SUBMIT BRIBE TRANSACTION
      // we bribe x_wrapped_bribe_address
      const bribeContract = wGetContract({
        abi: CONTRACTS.BRIBE_ABI,
        address: gauge.gauge?.xx_wrapped_bribe_address,
        signerOrProvider: signer,
      });

      const sendAmount = BigNumber(amount)
        .times(10 ** asset.decimals)
        .toFixed(0);

      const tx = await bribeContract.notifyRewardAmount(
        asset.address,
        ethers.BigNumber.from(sendAmount)
      );

      if (tx.hash) {
        this.emitter.emit(ACTIONS.TX_SUBMITTED, {
          uuid: bribeTXID,
          txHash: tx.hash,
        });
      }

      const rec = await tx.wait(1);

      if (rec.transactionHash) {
        this.emitter.emit(ACTIONS.TX_CONFIRMED, {
          uuid: bribeTXID,
          txHash: rec.transactionHash,
        });

        await this.updatePairsCall(account);

        this.emitter.emit(ACTIONS.BRIBE_CREATED);
      }
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  _getBribeAllowance = async (
    token: BaseAsset,
    pair: Gauge,
    account: { address: `0x${string}` }
  ) => {
    try {
      const allowance = await viemClient.readContract({
        address: token.address,
        abi: CONTRACTS.ERC20_ABI,
        functionName: "allowance",
        // We only bribe x_wrapped_bribe_address
        args: [account.address, pair.gauge.xx_wrapped_bribe_address],
      });

      return formatUnits(allowance, token.decimals);
    } catch (ex) {
      console.error(ex);
      return null;
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

      const { tokenID } = payload.content;

      const pairs = this.getStore("pairs");
      const veToken = this.getStore("veToken");
      const govToken = this.getStore("govToken");
      if (!veToken || !govToken)
        throw new Error(
          "Error getting veToken and govToken in getRewardBalances"
        );

      const gauges = pairs.filter(hasGauge);

      const filteredPairs = structuredClone(gauges);
      const x_filteredPairs = structuredClone(gauges);
      const xx_filteredPairs = structuredClone(gauges);
      const filteredPairs2 = structuredClone(gauges);

      let veDistReward: VeDistReward[] = [];

      let filteredBribes: Gauge[] = []; // Pair with gauge rewardType set to "Bribe"
      let x_filteredBribes: Gauge[] = []; // Pair with gauge rewardType set to "XBribe"
      let xx_filteredBribes: Gauge[] = []; // Pair with gauge rewardType set to "XBribe"

      if (tokenID) {
        const calls = filteredPairs.flatMap((pair) =>
          pair.gauge.bribes.map(
            (bribe) =>
              ({
                address: pair.gauge.wrapped_bribe_address,
                abi: CONTRACTS.BRIBE_ABI,
                functionName: "earned",
                args: [bribe.token.address, BigInt(tokenID)],
              } as const)
          )
        );
        const callsChunks = chunkArray(calls, 100);

        const earnedBribesAllPairs = await multicallChunks(callsChunks);

        const x_calls = x_filteredPairs.flatMap((pair) =>
          pair.gauge.x_bribes.map(
            (bribe) =>
              ({
                address: pair.gauge.x_wrapped_bribe_address,
                abi: CONTRACTS.BRIBE_ABI,
                functionName: "earned",
                args: [bribe.token.address, BigInt(tokenID)],
              } as const)
          )
        );
        const x_callsChunks = chunkArray(x_calls, 100);

        const x_earnedBribesAllPairs = await multicallChunks(x_callsChunks);

        const xx_calls = x_filteredPairs.flatMap((pair) =>
          pair.gauge.xx_bribes.map(
            (bribe) =>
              ({
                address: pair.gauge.xx_wrapped_bribe_address,
                abi: CONTRACTS.BRIBE_ABI,
                functionName: "earned",
                args: [bribe.token.address, BigInt(tokenID)],
              } as const)
          )
        );
        const xx_callsChunks = chunkArray(xx_calls, 100);

        const xx_earnedBribesAllPairs = await multicallChunks(xx_callsChunks);

        filteredPairs.forEach((pair) => {
          const earnedBribesPair = earnedBribesAllPairs.splice(
            0,
            pair.gauge.bribes.length
          );
          pair.gauge.bribesEarned = pair.gauge.bribes.map((bribe, i) => {
            return {
              ...bribe,
              earned: formatUnits(
                earnedBribesPair[i],
                bribe.token.decimals
              ) as `${number}`,
            };
          });
        });

        x_filteredPairs.forEach((pair) => {
          const x_earnedBribesPair = x_earnedBribesAllPairs.splice(
            0,
            pair.gauge.x_bribes.length
          );
          pair.gauge.x_bribesEarned = pair.gauge.x_bribes.map((bribe, i) => {
            return {
              ...bribe,
              earned: formatUnits(
                x_earnedBribesPair[i],
                bribe.token.decimals
              ) as `${number}`,
            };
          });
        });

        xx_filteredPairs.forEach((pair) => {
          const xx_earnedBribesPair = xx_earnedBribesAllPairs.splice(
            0,
            pair.gauge.xx_bribes.length
          );
          pair.gauge.xx_bribesEarned = pair.gauge.xx_bribes.map((bribe, i) => {
            return {
              ...bribe,
              earned: formatUnits(
                xx_earnedBribesPair[i],
                bribe.token.decimals
              ) as `${number}`,
            };
          });
        });

        filteredBribes = filteredPairs
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
                  parseUnits(
                    pair.gauge.bribesEarned[i].earned as `${number}`,
                    pair.gauge.bribes[i].token.decimals
                  ) > 0
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

        x_filteredBribes = x_filteredPairs
          .filter((pair) => {
            if (
              pair.gauge &&
              pair.gauge.x_bribesEarned &&
              pair.gauge.x_bribesEarned.length > 0
            ) {
              let shouldReturn = false;

              for (let i = 0; i < pair.gauge.x_bribesEarned.length; i++) {
                if (
                  pair.gauge.x_bribesEarned[i].earned &&
                  parseUnits(
                    pair.gauge.x_bribesEarned[i].earned as `${number}`,
                    pair.gauge.x_bribes[i].token.decimals
                  ) > 0
                ) {
                  shouldReturn = true;
                }
              }

              return shouldReturn;
            }

            return false;
          })
          .map((pair) => {
            pair.rewardType = "XBribe";
            return pair;
          });

        xx_filteredBribes = xx_filteredPairs
          .filter((pair) => {
            if (
              pair.gauge.xx_bribesEarned &&
              pair.gauge.xx_bribesEarned.length > 0
            ) {
              let shouldReturn = false;

              for (let i = 0; i < pair.gauge.xx_bribesEarned.length; i++) {
                if (
                  pair.gauge.xx_bribesEarned[i].earned &&
                  parseUnits(
                    pair.gauge.xx_bribesEarned[i].earned as `${number}`,
                    pair.gauge.xx_bribes[i].token.decimals
                  ) > 0
                ) {
                  shouldReturn = true;
                }
              }

              return shouldReturn;
            }

            return false;
          })
          .map((pair) => {
            pair.rewardType = "XXBribe";
            return pair;
          });

        const veDistEarned = await viemClient.readContract({
          address: CONTRACTS.VE_DIST_ADDRESS,
          abi: CONTRACTS.VE_DIST_ABI,
          functionName: "claimable",
          args: [BigInt(tokenID)],
        });

        const vestNFTs = this.getStore("vestNFTs");
        let theNFT = vestNFTs.filter((vestNFT) => {
          return vestNFT.id === tokenID;
        });

        if (veDistEarned > 0) {
          veDistReward.push({
            token: theNFT[0],
            lockToken: veToken,
            rewardToken: govToken,
            earned: formatUnits(veDistEarned, govToken.decimals),
            rewardType: "Distribution",
          });
        }
      }

      const rewardsCalls = filteredPairs2.map((pair) => {
        return {
          address: pair.gauge.address,
          abi: CONTRACTS.GAUGE_ABI,
          functionName: "earned",
          args: [CONTRACTS.GOV_TOKEN_ADDRESS, account.address],
        } as const;
      });

      const rewardsEarnedCallResult = await viemClient.multicall({
        allowFailure: false,
        multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
        contracts: rewardsCalls,
      });

      const rewardsEarned = [...filteredPairs2];

      for (let i = 0; i < rewardsEarned.length; i++) {
        rewardsEarned[i].gauge.rewardsEarned = formatEther(
          rewardsEarnedCallResult[i]
        );
      }

      const filteredRewards: Gauge[] = []; // Pair with rewardType set to "Reward"
      for (let j = 0; j < rewardsEarned.length; j++) {
        let pair = Object.assign({}, rewardsEarned[j]);
        if (
          pair.gauge &&
          pair.gauge.rewardsEarned &&
          parseEther(pair.gauge.rewardsEarned as `${number}`) > 0
        ) {
          pair.rewardType = "Reward";
          filteredRewards.push(pair);
        }
      }

      const rewards: Store["store"]["rewards"] = {
        bribes: filteredBribes,
        xBribes: x_filteredBribes,
        xxBribes: xx_filteredBribes,
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
      pair: Gauge;
      tokenID: string;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const signer = stores.accountStore.getEthersSigner();
      if (!signer) {
        console.warn("signer not found");
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

      const voterContract = wGetContract({
        address: CONTRACTS.VOTER_ADDRESS,
        abi: CONTRACTS.VOTER_ABI,
        signerOrProvider: signer,
      });

      const sendGauges = [pair.gauge.wrapped_bribe_address];
      const sendTokens = [
        pair.gauge.bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        }),
      ];

      const tx = await voterContract.claimBribes(
        sendGauges,
        sendTokens as `0x${string}`[][],
        ethers.BigNumber.from(tokenID)
      );

      if (tx.hash) {
        this.emitter.emit(ACTIONS.TX_SUBMITTED, {
          uuid: claimTXID,
          txHash: tx.hash,
        });
      }

      const rec = await tx.wait(1);

      if (rec.transactionHash) {
        this.emitter.emit(ACTIONS.TX_CONFIRMED, {
          uuid: claimTXID,
          txHash: rec.transactionHash,
        });

        this.getRewardBalances({
          type: "Internal rewards balances",
          content: { tokenID },
        });
        this.emitter.emit(ACTIONS.CLAIM_REWARD_RETURNED);
      }
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimXBribes = async (payload: {
    type: string;
    content: {
      pair: Gauge;
      tokenID: string;
    };
  }) => {
    try {
      const account = stores.accountStore.getStore("account");
      if (!account) {
        console.warn("account not found");
        return null;
      }

      const signer = stores.accountStore.getEthersSigner();
      if (!signer) {
        console.warn("signer not found");
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
      const voterContract = wGetContract({
        address: CONTRACTS.VOTER_ADDRESS,
        abi: CONTRACTS.VOTER_ABI,
        signerOrProvider: signer,
      });

      const sendGauges = [pair.gauge.wrapped_bribe_address];
      const sendTokens = [
        pair.gauge.bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        }),
      ];

      const tx = await voterContract.claimBribes(
        sendGauges,
        sendTokens as `0x${string}`[][],
        ethers.BigNumber.from(tokenID)
      );

      if (tx.hash) {
        this.emitter.emit(ACTIONS.TX_SUBMITTED, {
          uuid: claimTXID,
          txHash: tx.hash,
        });
      }

      const rec = await tx.wait(1);

      if (rec.transactionHash) {
        this.emitter.emit(ACTIONS.TX_CONFIRMED, {
          uuid: claimTXID,
          txHash: rec.transactionHash,
        });

        this.getRewardBalances({
          type: "Internal rewards balances",
          content: { tokenID },
        });
        this.emitter.emit(ACTIONS.CLAIM_REWARD_RETURNED);
      }
    } catch (ex) {
      console.error(ex);
      this.emitter.emit(ACTIONS.ERROR, ex);
    }
  };

  claimXXBribes = async (payload: {
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
        CONTRACTS.VOTER_ABI as unknown as AbiItem[],
        CONTRACTS.VOTER_ADDRESS
      );

      const sendGauges = [pair.gauge?.xx_wrapped_bribe_address];
      const sendTokens = [
        pair.gauge?.xx_bribesEarned?.map((bribe) => {
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
      let claim01TXID = this.getTXUUID();
      let claim0TXID = this.getTXUUID();
      let claimTXID = this.getTXUUID();
      let rewardClaimTXIDs: string[] = [];
      let distributionClaimTXIDs: string[] = [];

      let bribePairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "Bribe";
      });
      let xBribePairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "XBribe";
      });
      let xxBribePairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "XXBribe";
      });

      let rewardPairs = (pairs as Pair[]).filter((pair) => {
        return pair.rewardType === "Reward";
      });

      let distribution = (pairs as VeDistReward[]).filter((pair) => {
        return pair.rewardType === "Distribution";
      });

      const sendGauges01 = xxBribePairs.map((pair) => {
        return pair.gauge?.xx_wrapped_bribe_address;
      });
      const sendTokens01 = xxBribePairs.map((pair) => {
        return pair.gauge?.xx_bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        });
      });
      const sendGauges0 = xBribePairs.map((pair) => {
        return pair.gauge?.x_wrapped_bribe_address;
      });
      const sendTokens0 = xBribePairs.map((pair) => {
        return pair.gauge?.x_bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        });
      });
      const sendGauges = bribePairs.map((pair) => {
        return pair.gauge?.wrapped_bribe_address;
      });
      const sendTokens = bribePairs.map((pair) => {
        return pair.gauge?.bribesEarned?.map((bribe) => {
          return (bribe as Bribe).token.address;
        });
      });

      if (
        bribePairs.length == 0 &&
        xBribePairs.length == 0 &&
        xxBribePairs.length == 0 &&
        rewardPairs.length == 0
      ) {
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

      if (xxBribePairs.length > 0) {
        sendOBJ.transactions.push({
          uuid: claim01TXID,
          description: `Claiming all your available bribes`,
          status: TransactionStatus.WAITING,
        });
      }
      if (xBribePairs.length > 0) {
        sendOBJ.transactions.push({
          uuid: claim0TXID,
          description: `Claiming all your available bribes`,
          status: TransactionStatus.WAITING,
        });
      }
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

      if (xxBribePairs.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const gaugesContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            gaugesContract,
            "claimBribes",
            [sendGauges01, sendTokens01, tokenID],
            account,
            claim0TXID,
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
      if (xBribePairs.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const gaugesContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
          CONTRACTS.VOTER_ADDRESS
        );

        const claimPromise = new Promise<void>((resolve, reject) => {
          context._callContractWait(
            gaugesContract,
            "claimBribes",
            [sendGauges0, sendTokens0, tokenID],
            account,
            claim0TXID,
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
      if (bribePairs.length > 0) {
        // SUBMIT CLAIM TRANSACTION
        const gaugesContract = new web3.eth.Contract(
          CONTRACTS.VOTER_ABI as unknown as AbiItem[],
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

        await claimPromise;
      }

      if (rewardPairs.length > 0) {
        for (let i = 0; i < rewardPairs.length; i++) {
          const gaugeContract = new web3.eth.Contract(
            CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
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
          CONTRACTS.VE_DIST_ABI as unknown as AbiItem[],
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
        CONTRACTS.GAUGE_ABI as unknown as AbiItem[],
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
        CONTRACTS.VE_DIST_ABI as unknown as AbiItem[],
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
