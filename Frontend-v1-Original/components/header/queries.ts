import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

import viemClient from "../../stores/connectors/viem";
import { usePairsData } from "../../lib/global/queries";
import { CONTRACTS, QUERY_KEYS } from "../../stores/constants/constants";
import { PairsCallResponse } from "../../stores/types/types";

const WEEK = 604800;

export const useTokenPrices = () => {
  const { data: pairsData } = usePairsData();
  return useQuery({
    queryKey: [QUERY_KEYS.TOKEN_PRICES, pairsData],
    queryFn: () => getTokenPrices(pairsData),
    enabled: !!pairsData,
  });
};

export const useTvl = () => {
  const { data: pairsData } = usePairsData();
  return useQuery({
    queryKey: [QUERY_KEYS.TVL, pairsData],
    queryFn: () => getTvl(pairsData),
    enabled: !!pairsData,
  });
};

export const useTbv = () => {
  const { data: pairsData } = usePairsData();
  return useQuery({
    queryKey: [QUERY_KEYS.TBV, pairsData],
    queryFn: () => getTbv(pairsData),
    enabled: !!pairsData,
  });
};

export const useCirculatingSupply = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.CIRCULATING_SUPPLY],
    queryFn: getCirculatingSupply,
    staleTime: 1000 * 60 * 10,
  });
};

export const useMarketCap = () => {
  const { data: circulatingSupply } = useCirculatingSupply();
  const { data: tokenPrices } = useTokenPrices();
  return useQuery({
    queryKey: [QUERY_KEYS.MARKET_CAP, circulatingSupply, tokenPrices],
    queryFn: () => getMarketCap(circulatingSupply, tokenPrices),
    staleTime: 1000 * 60 * 10,
    enabled: !!circulatingSupply && !!tokenPrices,
  });
};

export const useActivePeriod = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.ACTIVE_PERIOD],
    queryFn: getActivePeriod,
    refetchOnWindowFocus: false,
  });
};

const getActivePeriod = async () => {
  const activePeriod = viemClient.readContract({
    abi: CONTRACTS.MINTER_ABI,
    address: CONTRACTS.MINTER_ADDRESS,
    functionName: "active_period",
  });

  const activePeriodEnd = parseFloat(activePeriod.toString()) + WEEK;
  return activePeriodEnd;
};

const getTokenPrices = (pairsData: PairsCallResponse | undefined) => {
  if (!pairsData) throw new Error("Need pairs data");
  return new Map(pairsData.prices);
};

const getTvl = (pairsData: PairsCallResponse | undefined) => {
  if (!pairsData) throw new Error("Need pairs data");
  return pairsData.tvl;
};

const getTbv = (pairsData: PairsCallResponse | undefined) => {
  if (!pairsData) throw new Error("Need pairs data");
  return pairsData.tbv;
};

const getCirculatingSupply = async () => {
  const flowContract = {
    abi: CONTRACTS.GOV_TOKEN_ABI,
    address: CONTRACTS.GOV_TOKEN_ADDRESS,
  } as const;

  const [
    totalSupply,
    lockedSupply,
    flowInMinter,
    flowInMsig,
    flowInRewardsDistributor,
    flowInTimelockerController,
  ] = await viemClient.multicall({
    allowFailure: false,
    multicallAddress: CONTRACTS.MULTICALL_ADDRESS,
    contracts: [
      {
        ...flowContract,
        functionName: "totalSupply",
      },
      {
        ...flowContract,
        functionName: "balanceOf",
        args: [CONTRACTS.VE_TOKEN_ADDRESS],
      },
      {
        ...flowContract,
        functionName: "balanceOf",
        args: [CONTRACTS.MINTER_ADDRESS],
      },
      {
        ...flowContract,
        functionName: "balanceOf",
        args: [CONTRACTS.MSIG_ADDRESS],
      },
      {
        ...flowContract,
        functionName: "balanceOf",
        args: [CONTRACTS.VE_DIST_ADDRESS],
      },
      {
        ...flowContract,
        functionName: "balanceOf",
        args: ["0xd0cC9738866cd82B237A14c92ac60577602d6c18"],
      },
    ],
  });

  const circulatingSupply = formatUnits(
    totalSupply -
      lockedSupply -
      flowInMinter -
      flowInMsig -
      flowInRewardsDistributor -
      flowInTimelockerController,
    CONTRACTS.GOV_TOKEN_DECIMALS
  );

  return parseFloat(circulatingSupply);
};

const getMarketCap = async (
  circulatingSupply: number | undefined,
  tokenPrices: Map<string, number> | undefined
) => {
  if (!circulatingSupply || !tokenPrices)
    throw new Error("Missing circ supply or token prices");

  const price = tokenPrices.get(CONTRACTS.GOV_TOKEN_ADDRESS.toLowerCase());
  if (!price) throw new Error("Missing price");

  return circulatingSupply * price;
};
