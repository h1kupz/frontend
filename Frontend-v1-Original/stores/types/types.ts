interface BaseAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  local: boolean;
  balance: string | null;
  isWhitelisted?: boolean;
  listingFee?: string | number;
}

interface RouteAsset {
  price: number;
  nativeChainAddress: string; // if no,  set to :""
  nativeChainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: null | string;
}

type TokenForPrice = Omit<
  RouteAsset,
  "price" | "nativeChainAddress" | "nativeChainId" | "name" | "logoURI"
> &
  Partial<RouteAsset>;

type VeToken = Omit<BaseAsset, "balance" | "local">;
type GovToken = Omit<BaseAsset, "local"> & {
  balanceOf: string;
};

interface VestNFT {
  id: string;
  lockAmount: string;
  lockEnds: string;
  lockValue: string;
  voted: boolean;
}

interface Bribe {
  token: RouteAsset;
  reward_ammount: number;
  rewardAmmount: number;
  rewardAmount?: number; // gets assigned in frontend store and eq rewardAmmount
  earned?: string;
  tokenPrice?: number;
}

type BribeEarned = { earned: string };

interface Pair {
  tvl: number;
  apr: number;
  address: string;
  symbol: string;
  decimals: number;
  stable: boolean;
  total_supply: number;
  reserve0: number | string; // gets reassigned to string in frontend store
  reserve1: number | string; // gets reassigned to string in frontend store
  token0_address: string;
  token1_address: string;
  gauge_address: string; // if no,  set to :""
  isStable: boolean;
  totalSupply: number | string; // gets reassigned to string in frontend store
  token0: RouteAsset | BaseAsset; //TODO check if this is correct
  token1: RouteAsset | BaseAsset;
  rewardType?: string;
  claimable0?: string;
  claimable1?: string;
  balance?: string;
  isAliveGauge?: boolean;
  gauge?: {
    // exists only if gauge_address is not empty
    decimals: number;
    tbv: number;
    votes: number;
    apr: number;
    address: string;
    total_supply: number;
    bribe_address: string;
    fees_address: string;
    wrapped_bribe_address: string;
    reward: number;
    bribeAddress: string;
    feesAddress: string;
    totalSupply: number | string; //gets reassigned to string in frontend store
    bribes: Bribe[];
    // following gets assigned in frontend store
    balance?: string;
    reserve0?: string;
    reserve1?: string;
    weight?: string;
    weightPercent?: string;
    rewardsEarned?: string;
    bribesEarned?: Bribe[];
    bribesEarnedValue?: BribeEarned[];
  };
  gaugebribes?: Bribe[];
}

type WithRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

type Gauge = WithRequired<Pair, "gauge">;
const hasGauge = (pair: Pair): pair is Gauge =>
  pair && pair.gauge !== undefined;
const isGaugeReward = (reward: Gauge | VeDistReward): reward is Gauge =>
  reward && reward.rewardType !== "Distribution";

interface VeDistReward {
  token: VestNFT;
  lockToken: VeToken;
  rewardToken: Omit<BaseAsset, "local"> & {
    balanceOf: string;
  };
  earned: string;
  rewardType: "Distribution";
}

interface GeneralContracts {
  GOV_TOKEN_ADDRESS: string;
  GOV_TOKEN_NAME: string;
  GOV_TOKEN_SYMBOL: string;
  GOV_TOKEN_DECIMALS: number;
  GOV_TOKEN_LOGO: string;
  GOV_TOKEN_ABI: any[];
  VE_TOKEN_ADDRESS: string;
  VE_TOKEN_NAME: string;
  VE_TOKEN_SYMBOL: string;
  VE_TOKEN_DECIMALS: number;
  VE_TOKEN_LOGO: string;
  VE_TOKEN_ABI: any[];
  FACTORY_ADDRESS: string;
  FACTORY_ABI: any[];
  ROUTER_ADDRESS: string;
  ROUTER_ABI: any[];
  VE_DIST_ADDRESS: string;
  VE_DIST_ABI: any[];
  VOTER_ADDRESS: string;
  VOTER_ABI: any[];
  MINTER_ADDRESS: string;
  MINTER_ABI: any[];
  ERC20_ABI: any[];
  PAIR_ABI: any[];
  GAUGE_ABI: any[];
  BRIBE_ABI: any[];
  TOKEN_ABI: any[];
  MULTICALL_ADDRESS: string;
  STABLE_TOKEN_ADDRESS: string;
  MSIG_ADDRESS: string;
}

interface TestnetContracts extends GeneralContracts {
  WETH_ADDRESS: string;
  WETH_NAME: string;
  WETH_SYMBOL: string;
  WETH_DECIMALS: number;
  WETH_ABI: any[];
  ETH_ADDRESS: string;
  ETH_NAME: string;
  ETH_SYMBOL: string;
  ETH_DECIMALS: number;
  ETH_LOGO: string;
}
interface CantoContracts extends GeneralContracts {
  FLOW_V1_ADDRESS: string;
  FLOW_CONVERTOR_ADDRESS: string;
  FLOW_CONVERTOR_ABI: any[];
  WCANTO_ADDRESS: string;
  WCANTO_NAME: string;
  WCANTO_SYMBOL: string;
  WCANTO_DECIMALS: number;
  WCANTO_ABI: any[];
  CANTO_ADDRESS: string;
  CANTO_NAME: string;
  CANTO_SYMBOL: string;
  CANTO_DECIMALS: number;
  CANTO_LOGO: string;
}
interface ArbitrumContracts extends GeneralContracts {
  WETH_ADDRESS: string;
  WETH_NAME: string;
  WETH_SYMBOL: string;
  WETH_DECIMALS: number;
  WETH_ABI: any[];
  ETH_ADDRESS: string;
  ETH_NAME: string;
  ETH_SYMBOL: string;
  ETH_DECIMALS: number;
  ETH_LOGO: string;
}

type Contracts = TestnetContracts | CantoContracts | ArbitrumContracts;

type Vote = {
  address: string;
  votePercent: string;
};

type Votes = Array<Pick<Vote, "address"> & { value: number }>;

interface DexScrennerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: {
      buys: number;
      sells: number;
    };
    h1: {
      buys: number;
      sells: number;
    };
    h6: {
      buys: number;
      sells: number;
    };
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

interface DefiLlamaTokenPrice {
  coins: {
    [key: string]: {
      decimals: number;
      price: number;
      symbol: string;
      timestamp: number;
      confidence: number;
    };
  };
}

interface ITransaction {
  title: string;
  type: string;
  verb: string;
  transactions: {
    uuid: string;
    description: string;
    status: TransactionStatus;
    txHash?: string;
    error?: string;
  }[];
}

enum TransactionStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
  DONE = "DONE",
  WAITING = "WAITING",
}

type EthWindow = Window &
  typeof globalThis & {
    ethereum?: any;
  };

// FIREBIRD
interface QuoteSwapPayload {
  payload: {
    content: {
      fromAsset: BaseAsset;
      toAsset: BaseAsset;
      fromAmount: string;
      slippage: string;
    };
  };
  address: string;
}

interface QuoteSwapResponse {
  encodedData: {
    router: string;
    data: string;
  };
  maxReturn: {
    from: string;
    to: string;
    totalFrom: string;
    totalTo: number;
    totalGas: number;
    gasPrice: number;
    paths: Path[];
    tokens: FireBirdTokens;
  };
}

interface Path {
  amountFrom: string;
  amountTo: string;
  gas: number;
  swaps: Swap[];
}

interface Swap {
  from: string;
  to: string;
  amountFrom: string;
  amountTo: string;
  pool: string;
  swapFee: number;
  dex: string;
  meta?: {
    vaultAddress: string;
  };
}

interface FireBirdTokens {
  [address: string]: {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
    price: number;
  };
}

export type {
  BaseAsset,
  Pair,
  Gauge,
  VeDistReward,
  Bribe,
  RouteAsset,
  TokenForPrice,
  Contracts,
  TestnetContracts,
  CantoContracts,
  ArbitrumContracts,
  VeToken,
  GovToken,
  Vote,
  Votes,
  VestNFT,
  DexScrennerPair,
  DefiLlamaTokenPrice,
  ITransaction,
  EthWindow,
  QuoteSwapPayload,
  QuoteSwapResponse,
  Path,
  Swap,
  FireBirdTokens,
};

export { hasGauge, isGaugeReward, TransactionStatus };
