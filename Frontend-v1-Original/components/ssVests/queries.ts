import { useQuery } from "react-query";

import viemClient from "../../stores/connectors/viem";
import { CONTRACTS, ZERO_ADDRESS } from "../../stores/constants/constants";
import { VestNFT } from "../../stores/types/types";

const getAPROfNFT = async (tokenID?: string) => {
  try {
    if (!tokenID) return 0;
    const voteManagerContract = {
      abi: CONTRACTS.VOTE_MANAGER_ABI,
      address: CONTRACTS.VOTE_MANAGER_ADDRESS,
    } as const;

    const strat = await viemClient.readContract({
      ...voteManagerContract,
      functionName: "tokenIdToStrat",
      args: [BigInt(tokenID)],
    });

    let apr = 0;
    if (strat !== ZERO_ADDRESS) {
      const aprBigInt = await viemClient.readContract({
        address: strat,
        abi: CONTRACTS.VOTE_FARMER_ABI,
        functionName: "averageAPRAcrossLastNHarvests",
        args: [BigInt(2)],
      });
      apr = Number(aprBigInt);
    }

    return apr;
  } catch (e) {
    console.error(e);
    return 0;
  }
};

const getAPR = async () => {
  try {
    const voteManagerContract = {
      abi: CONTRACTS.VOTE_MANAGER_ABI,
      address: CONTRACTS.VOTE_MANAGER_ADDRESS,
    } as const;

    const apr = await viemClient.readContract({
      ...voteManagerContract,
      functionName: "averageAPRAcrossLastNHarvests",
      args: [BigInt(2)],
    });

    return Number(apr);
  } catch (e) {
    console.error(e);
    return 0;
  }
};

export const useAverageStrategiesDelegationAPR = (nft?: VestNFT) => {
  return useQuery({
    queryKey: ["vote manager", "apr", "all strats"],
    queryFn: () => getAPR(),
    enabled: !!nft && !nft.delegated,
    initialData: 0,
    staleTime: 1000 * 60,
  });
};

export const useAverageNftDelegationAPR = (nft?: VestNFT) => {
  return useQuery({
    queryKey: ["vote manager", "apr", nft?.id],
    queryFn: () => getAPROfNFT(nft?.id),
    enabled: !!nft && nft.delegated,
    initialData: 0,
    staleTime: 1000 * 60,
  });
};
