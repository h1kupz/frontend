import { useQuery } from "react-query";
import { formatEther, formatUnits, parseUnits, parseEther } from "viem";

import { useAccount } from "../../hooks/useAccount";
import { useGovToken, useVeToken, useVestNfts } from "../ssVests/queries";
import stores from "../../stores";
import viemClient, {
  chunkArray,
  multicallChunks,
} from "../../stores/connectors/viem";
import { CONTRACTS, ACTIONS } from "../../stores/constants/constants";
import {
  GovToken,
  Pair,
  VeDistReward,
  VeToken,
  VestNFT,
  hasGauge,
} from "../../stores/types/types";

export const getRewardBalances = async (
  account: { address: `0x${string}` } | null,
  tokenID: string,
  vestNFTs?: VestNFT[] | null,
  veToken?: VeToken | null,
  govToken?: GovToken | null
) => {
  try {
    if (!account) {
      console.warn("account not found");
      return null;
    }

    const pairs = stores.stableSwapStore.getStore("pairs");

    if (!veToken || !govToken)
      throw new Error(
        "Error getting veToken and govToken in getRewardBalances"
      );

    const filteredPairs = [...pairs.filter(hasGauge)];

    const filteredPairs2 = [...pairs.filter(hasGauge)];

    let veDistReward: VeDistReward[] = [];

    let filteredBribes: Pair[] = []; // Pair with rewardType set to "Bribe"

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

      const veDistEarned = await viemClient.readContract({
        address: CONTRACTS.VE_DIST_ADDRESS,
        abi: CONTRACTS.VE_DIST_ABI,
        functionName: "claimable",
        args: [BigInt(tokenID)],
      });

      let theNFT = (vestNFTs ?? []).filter((vestNFT) => {
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

    const filteredRewards: Pair[] = []; // Pair with rewardType set to "Reward"
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

    const rewards = {
      bribes: filteredBribes,
      rewards: filteredRewards,
      veDist: veDistReward,
    };

    return rewards;
  } catch (ex) {
    console.error(ex);
    stores.emitter.emit(ACTIONS.ERROR, ex);
  }
};

export const useNftRewards = (tokenID: string) => {
  const account = useAccount();

  const { data: govToken } = useGovToken();
  const { data: veToken } = useVeToken();
  const { data: vestNfts } = useVestNfts();

  return useQuery({
    queryKey: [
      "vests",
      "rewards",
      account?.address,
      govToken,
      veToken,
      vestNfts,
      tokenID,
    ],
    queryFn: () =>
      getRewardBalances(account, tokenID, vestNfts, veToken, govToken),
    enabled: !!account && !!govToken && !!veToken && !!vestNfts,
    initialData: { bribes: [], rewards: [], veDist: [] },
  });
};
