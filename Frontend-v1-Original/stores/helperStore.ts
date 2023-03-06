import type { AbiItem } from "web3-utils";
import BigNumber from "bignumber.js";

import stores from ".";
import { CONTRACTS, NATIVE_TOKEN } from "./constants/constants";

import {
  CantoContracts,
  DefiLlamaTokenPrice,
  DexScrennerPair,
  TokenForPrice,
} from "./types/types";

const isArbitrum = process.env.NEXT_PUBLIC_CHAINID === "42161";
const WEEK = 604800;

// # See: https://docs.1inch.io/docs/aggregation-protocol/api/swagger
// # See: https://docs.dexscreener.com/#tokens
// # See: https://defillama.com/docs/api#operations-tag-coins
// # See: https://api.dev.dex.guru/docs#tag/Token-Finance
// # See: https://docs.open.debank.com/en/reference/api-pro-reference/token

class Helper {
  private aggregatorEndpoint = "https://api.1inch.io/v4.0/10/quote";
  private defiLlamaBaseUrl = "https://api.llama.fi";
  private defiLlamaTokenUrl = "https://coins.llama.fi/prices/current";
  private debankEndpoint =
    "https://pro-openapi.debank.com/v1/token?chain=canto";
  private dexScrennerEndpoint = "https://api.dexscreener.com/latest/dex/tokens";
  private dexGuruEndpoint =
    "https://api.dev.dex.guru/v1/chain/10/tokens/%/market";
  private tokenPricesMap = new Map<string, number>();

  // TEMPORARY
  getV1Balance = async () => {
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

    const v1Contract = new web3.eth.Contract(
      CONTRACTS.GOV_TOKEN_ABI as AbiItem[],
      (CONTRACTS as CantoContracts).FLOW_V1_ADDRESS
    );
    const balance = await v1Contract.methods.balanceOf(account.address).call();
    const _v1Balance = BigNumber(balance)
      .div(10 ** 18)
      .toString();
    return _v1Balance;
  };

  get getTokenPricesMap() {
    return this.tokenPricesMap;
  }

  // TODO: understand token prices in python
  // setTokenPricesMap = async (tokenPrices: Map<string, number>) => {
  //   this.tokenPricesMap = tokenPrices;
  // };

  getProtocolDefiLlama = async () => {
    const data = await fetch(`${this.defiLlamaBaseUrl}/protocol/velocimeter`);
    const json = await data.json();
    return json as unknown;
  };

  getCurrentTvl = async () => {
    const response = await fetch(`${this.defiLlamaBaseUrl}/tvl/velocimeter`);
    const json = await response.json();
    return json as number;
  };

  getActivePeriod = async () => {
    try {
      const web3 = await stores.accountStore.getWeb3Provider();
      const minterContract = new web3.eth.Contract(
        CONTRACTS.MINTER_ABI as AbiItem[],
        CONTRACTS.MINTER_ADDRESS
      );
      const activePeriod = await minterContract.methods.active_period().call();
      const activePeriodEnd = parseInt(activePeriod) + WEEK;
      return activePeriodEnd;
    } catch (ex) {
      console.log("EXCEPTION. ACTIVE PERIOD ERROR");
      console.log(ex);
      return 0;
    }
  };

  updateTokenPrice = async (token: TokenForPrice) => {
    if (this.tokenPricesMap.has(token.address.toLowerCase())) {
      return this.tokenPricesMap.get(token.address.toLowerCase());
    }

    const price = await this._getTokenPrice(token);
    this.tokenPricesMap.set(token.address.toLowerCase(), price);
    return price;
  };

  getCirculatingSupply = async () => {
    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) return;

    const flowContract = new web3.eth.Contract(
      CONTRACTS.GOV_TOKEN_ABI,
      CONTRACTS.GOV_TOKEN_ADDRESS
    );
    const totalSupply = await flowContract.methods.totalSupply().call();

    const lockedSupply = await flowContract.methods
      .balanceOf(CONTRACTS.VE_TOKEN_ADDRESS)
      .call();

    const flowInMinter = await flowContract.methods
      .balanceOf(CONTRACTS.MINTER_ADDRESS)
      .call();

    const flowInMsig = await flowContract.methods
      .balanceOf(CONTRACTS.MSIG_ADDRESS)
      .call();

    const flowInTimelockerController = await flowContract.methods
      .balanceOf("0xd0cC9738866cd82B237A14c92ac60577602d6c18")
      .call();

    const circulatingSupply = BigNumber(totalSupply)
      .minus(BigNumber(lockedSupply))
      .minus(BigNumber(flowInMinter))
      .minus(BigNumber(flowInMsig))
      .minus(BigNumber(flowInTimelockerController))
      .div(10 ** NATIVE_TOKEN.decimals)
      .toNumber();

    return circulatingSupply;
  };

  getMarketCap = async () => {
    const circulatingSupply = await this.getCirculatingSupply();
    const price = await this.updateTokenPrice({
      address: CONTRACTS.GOV_TOKEN_ADDRESS,
      decimals: CONTRACTS.GOV_TOKEN_DECIMALS,
      symbol: CONTRACTS.GOV_TOKEN_SYMBOL,
    });
    return circulatingSupply * price;
  };

  protected _getTokenPrice = async (token: TokenForPrice) => {
    let price = 0;

    price = await this._getAggregatedPriceInStables(token);

    if (price === 0) {
      price = await this._getChainPriceInStables(token);
    }
    // TODO this one needs api keys and is not free
    // if (price === 0) {
    //   price = await this._getDebankPriceInStables(token);
    // }
    return price;
  };

  protected _getAggregatedPriceInStables = async (token: TokenForPrice) => {
    const price = await this._getDefillamaPriceInStables(token);

    if (price !== 0) {
      return price;
    }

    try {
      return await this._getDexscreenerPriceInStables(token);
    } catch (ex) {
      console.warn(ex);
      return price;
    }
  };

  protected _getDefillamaPriceInStables = async (token: TokenForPrice) => {
    if (token.address === CONTRACTS.STABLE_TOKEN_ADDRESS) {
      return 1.0;
    }

    const chainName = isArbitrum ? "arbitrum" : "canto";
    const chainToken = `${chainName}:${token.address.toLowerCase()}`;

    const res = await fetch(`${this.defiLlamaTokenUrl}/${chainToken}`);
    const json = (await res.json()) as DefiLlamaTokenPrice;
    const price = json.coins[chainToken]?.price;

    if (price > 0) {
      return price;
    }

    return 0;
  };

  protected _getChainPriceInStables = async (token: TokenForPrice) => {
    const web3 = await stores.accountStore.getWeb3Provider();

    if (!web3) return 0;

    if (token.address === CONTRACTS.STABLE_TOKEN_ADDRESS) {
      return 1.0;
    }

    const routerContract = new web3.eth.Contract(
      CONTRACTS.ROUTER_ABI as AbiItem[],
      CONTRACTS.ROUTER_ADDRESS
    );

    try {
      const amountOutFromContract: {
        amount: string;
        stable: boolean;
      } = await routerContract.methods
        .getAmountOut(
          BigNumber(10).pow(token.decimals),
          token.address,
          CONTRACTS.STABLE_TOKEN_ADDRESS
        )
        .call();
      return BigNumber(amountOutFromContract.amount)
        .div(BigNumber(10).pow(6)) //stablecoin decimals
        .toNumber();
    } catch (ex) {
      return 0;
    }
  };

  protected _getDebankPriceInStables = async (token: TokenForPrice) => {
    if (token.address === CONTRACTS.STABLE_TOKEN_ADDRESS) {
      return 1.0;
    }

    const res = await fetch(
      `${this.debankEndpoint}&id=${token.address.toLowerCase()}`
    );
    const json = await res.json();
    const price = json.price;

    return 0;
  };

  protected _getDexscreenerPriceInStables = async (token: TokenForPrice) => {
    if (token.address === CONTRACTS.STABLE_TOKEN_ADDRESS) {
      return 1.0;
    }

    const res = await fetch(`
      ${this.dexScrennerEndpoint}/${token.address.toLowerCase()}
    `);
    const json = await res.json();
    const pairs = json.pairs as DexScrennerPair[];

    if (pairs?.length === 0) {
      return 0;
    }

    const sortedPairs = pairs.sort(
      (a, b) =>
        b.txns.h24.buys +
        b.txns.h24.sells -
        (a.txns.h24.buys + a.txns.h24.sells)
    );

    const price = sortedPairs.filter(
      (pair) => pair.baseToken.symbol === token.symbol
    )[0]?.priceUsd;

    return parseFloat(price);
  };
}

export default Helper;
