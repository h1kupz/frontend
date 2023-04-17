import {
  useQuery,
  type QueryClient,
  useQueryClient,
  useMutation,
} from "react-query";
import { formatUnits } from "viem";
import type { AbiItem } from "web3-utils";

import { useAccount } from "../../hooks/useAccount";
import { getRewardBalances } from "../ssRewards/queries";
import stores from "../../stores";
import viemClient from "../../stores/connectors/viem";
import {
  CONTRACTS,
  ZERO_ADDRESS,
  ACTIONS,
} from "../../stores/constants/constants";
import { Bribe, GovToken, VeToken, VestNFT } from "../../stores/types/types";
import { getTXUUID } from "../../utils/utils";

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
    queryKey: ["govTokenBase", account?.address],
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
    queryKey: ["vests", "allNfts", account?.address],
    queryFn: () => getVestNFTs(account, govToken, veToken),
    enabled: !!account && !!govToken && !!veToken,
    initialData: [],
  });
};

const resetVest = async (
  queryClient: QueryClient,
  account: { address: `0x${string}` } | null,
  tokenID: string,
  govToken?: GovToken | null,
  veToken?: VeToken | null,
  vestNFTs?: VestNFT[] | null
) => {
  try {
    if (!account) {
      console.warn("account not found");
      return null;
    }

    if (!veToken || !govToken) {
      console.warn("veToken or govToken not found");
      return null;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      console.warn("web3 not found");
      return null;
    }

    // ADD TRNASCTIONS TO TRANSACTION QUEUE DISPLAY
    let rewardsTXID = getTXUUID();
    let rebaseTXID = getTXUUID();
    let resetTXID = getTXUUID();

    stores.emitter.emit(ACTIONS.TX_ADDED, {
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
    const rewards = await getRewardBalances(
      account,
      tokenID,
      vestNFTs,
      veToken,
      govToken
    );

    if (rewards?.bribes.length && rewards.bribes.length > 0) {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: rewardsTXID,
        description: `Unclaimed bribes found, claiming`,
      });
    } else {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: rewardsTXID,
        description: `No unclaimed bribes found`,
        status: "DONE",
      });
    }

    if (rewards?.bribes.length && rewards.bribes.length > 0) {
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
        stores.stableSwapStore._callContractWait(
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

    if (rewards?.veDist.length && rewards.veDist.length > 0) {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: rebaseTXID,
        description: `Claiming rebase distribution`,
      });
    } else {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: rebaseTXID,
        description: `No unclaimed rebase`,
        status: "DONE",
      });
    }

    if (rewards?.veDist.length && rewards.veDist.length > 0) {
      // SUBMIT CLAIM TRANSACTION
      const veDistContract = new web3.eth.Contract(
        CONTRACTS.VE_DIST_ABI as unknown as AbiItem[],
        CONTRACTS.VE_DIST_ADDRESS
      );

      const claimVeDistPromise = new Promise<void>((resolve, reject) => {
        stores.stableSwapStore._callContractWait(
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
      CONTRACTS.VOTER_ABI as unknown as AbiItem[],
      CONTRACTS.VOTER_ADDRESS
    );

    stores.stableSwapStore._callContractWait(
      voterContract,
      "reset",
      [tokenID],
      account,
      resetTXID,
      (err) => {
        if (err) {
          return stores.emitter.emit(ACTIONS.ERROR, err);
        }
        queryClient.invalidateQueries(["vests", "allNfts"]);
      }
    );
  } catch (e) {
    console.log(e);
    console.log("RESET VEST ERROR");
  }
};

export const useResetVest = () => {
  const queryClient = useQueryClient();
  const account = useAccount();

  const { data: govToken } = useGovToken();
  const { data: veToken } = useVeToken();
  const { data: vestNfts } = useVestNfts();

  return useMutation({
    mutationFn: (tokenID: string) =>
      resetVest(queryClient, account, tokenID, govToken, veToken, vestNfts),
  });
};
