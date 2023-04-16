import { useQuery } from "react-query";
import { formatUnits } from "viem";

import { useAccount } from "../../hooks/useAccount";
import stores from "../../stores";
import viemClient from "../../stores/connectors/viem";
import {
  CONTRACTS,
  ZERO_ADDRESS,
  ACTIONS,
} from "../../stores/constants/constants";
import { GovToken, VeToken, VestNFT } from "../../stores/types/types";

const getGovTokenBase = async (account: { address: `0x${string}` } | null) => {
  if (!account) {
    console.warn("account not found");
    return null;
  }

  const balanceOf = await viemClient.readContract({
    abi: CONTRACTS.GOV_TOKEN_ABI,
    address: CONTRACTS.GOV_TOKEN_ADDRESS,
    functionName: "balanceOf",
    args: [account.address],
  });

  return {
    address: CONTRACTS.GOV_TOKEN_ADDRESS,
    name: CONTRACTS.GOV_TOKEN_NAME,
    symbol: CONTRACTS.GOV_TOKEN_SYMBOL,
    decimals: CONTRACTS.GOV_TOKEN_DECIMALS,
    logoURI: CONTRACTS.GOV_TOKEN_LOGO,
    balanceOf: balanceOf.toString(),
    balance: formatUnits(balanceOf, CONTRACTS.GOV_TOKEN_DECIMALS),
  } as const;
};

const getVeTokenBase = () => {
  return {
    address: CONTRACTS.VE_TOKEN_ADDRESS,
    name: CONTRACTS.VE_TOKEN_NAME,
    symbol: CONTRACTS.VE_TOKEN_SYMBOL,
    decimals: CONTRACTS.VE_TOKEN_DECIMALS,
    logoURI: CONTRACTS.VE_TOKEN_LOGO,
    balance: null,
    balanceOf: "",
  } as const;
};

const getVestNFTs = async (
  account?: { address: `0x${string}` } | null,
  veToken?: VeToken | null,
  govToken?: GovToken | null
) => {
  try {
    if (!account) {
      console.warn("account not found");
      return [];
    }

    if (!veToken || !govToken) {
      throw new Error("veToken or govToken not found");
    }

    const vestingContract = {
      abi: CONTRACTS.VE_TOKEN_ABI,
      address: CONTRACTS.VE_TOKEN_ADDRESS,
    } as const;
    const voteManagerContract = {
      abi: CONTRACTS.VOTE_MANAGER_ABI,
      address: CONTRACTS.VOTE_MANAGER_ADDRESS,
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

        const [[lockedAmount, lockedEnd], lockValue, strat] =
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
                ...voteManagerContract,
                functionName: "tokenIdToStrat",
                args: [tokenIndex],
              },
            ],
          });

        let autolock = false;
        if (strat !== ZERO_ADDRESS) {
          const [, _autolock] = await viemClient.readContract({
            address: strat,
            abi: CONTRACTS.VOTE_FARMER_ABI,
            functionName: "tokenIdToInfo",
            args: [tokenIndex],
          });
          autolock = _autolock;
        }

        const voted = await stores.stableSwapStore._checkNFTVotedEpoch(
          tokenIndex.toString()
        );

        // probably do some decimals math before returning info. Maybe get more info. I don't know what it returns.
        return {
          id: tokenIndex.toString(),
          lockEnds: lockedEnd.toString(),
          lockAmount: formatUnits(lockedAmount, govToken.decimals),
          lockValue: formatUnits(lockValue, veToken.decimals),
          voted,
          autolock,
          delegated: strat !== ZERO_ADDRESS,
        };
      })
    );

    stores.emitter.emit(ACTIONS.VEST_NFTS_RETURNED, nfts);
    return nfts;
  } catch (ex) {
    console.error(ex);
    stores.emitter.emit(ACTIONS.ERROR, ex);
    return [];
  }
};

export const useGovToken = () => {
  const account = useAccount();
  return useQuery({
    queryKey: ["govTokenBase", account],
    queryFn: () => getGovTokenBase(account),
    enabled: !!account,
    initialData: null,
  });
};

export const useVeToken = () => {
  return useQuery({
    queryKey: ["veTokenBase"],
    queryFn: () => getVeTokenBase(),
    initialData: null,
  });
};

export const useVestNfts = () => {
  const account = useAccount();

  const { data: govToken } = useGovToken();
  const { data: veToken } = useVeToken();

  return useQuery({
    queryKey: ["vests", "allNfts", account],
    queryFn: () => getVestNFTs(account, govToken, veToken),
    enabled: !!account && !!govToken && !!veToken,
    initialData: [],
  });
};