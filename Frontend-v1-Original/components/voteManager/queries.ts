import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "react-query";
import type { AbiItem } from "web3-utils";

import viemClient from "../../stores/connectors/viem";
import stores from "../../stores";
import {
  CONTRACTS,
  ZERO_ADDRESS,
  ACTIONS,
} from "../../stores/constants/constants";
import { VestNFT } from "../../stores/types/types";
import { useAccount } from "../../hooks/useAccount";
import { getTXUUID } from "../../utils/utils";

const getNFTAllowance = async (
  tokenID: string,
  stratAddress: `0x${string}`
) => {
  try {
    const votingContract = {
      address: CONTRACTS.VE_TOKEN_ADDRESS,
      abi: CONTRACTS.VE_TOKEN_ABI,
    } as const;

    const isApproved = await viemClient.readContract({
      ...votingContract,
      functionName: "isApprovedOrOwner",
      args: [stratAddress, BigInt(tokenID)],
    });

    return isApproved;
  } catch (e) {
    console.error(e);
    return null;
  }
};

const delegate = async (
  queryClient: QueryClient,
  account: { address: `0x${string}` } | null,
  tokenID?: string,
  autolock?: boolean
) => {
  try {
    if (!tokenID || tokenID === "0") {
      throw new Error("Invalid token ID");
    }

    const web3 = await stores.accountStore.getWeb3Provider();

    if (!web3) {
      throw new Error("No web3 provider");
    }
    if (!account) {
      throw new Error("No account provider");
    }

    let allowanceTXID = getTXUUID();
    let delegateTXID = getTXUUID();
    let autolockTXID = getTXUUID();

    stores.emitter.emit(ACTIONS.TX_ADDED, {
      title: `Delegate your veNFT to the Vote Manager`,
      type: "Delegate",
      verb: "Delegated",
      transactions: [
        {
          uuid: allowanceTXID,
          description: `Checking your veNFT approval`,
          status: "WAITING",
        },
        {
          uuid: delegateTXID,
          description: `Delegating your veNFT to the vote manager`,
          status: "WAITING",
        },
        {
          uuid: autolockTXID,
          description: "Checking if you enabled autolock",
          status: "WAITING",
        },
      ],
    });

    const [stratAddress] = await viemClient.readContract({
      address: CONTRACTS.VOTE_MANAGER_ADDRESS,
      abi: CONTRACTS.VOTE_MANAGER_ABI,
      functionName: "selectDepositStrategy",
    });

    // CHECK ALLOWANCES AND SET TX DISPLAY
    const allowance = await getNFTAllowance(tokenID, stratAddress);
    if (allowance === null)
      throw new Error("Error getting approval in create vest");
    if (!allowance) {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: allowanceTXID,
        description: `Approve the vote manager to operate your NFT`,
      });
    } else {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: allowanceTXID,
        description: `NFT is approved to be operated by the vote manager`,
        status: "DONE",
      });
    }

    if (!autolock) {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: autolockTXID,
        description: "Autolock is not enabled",
        status: "DONE",
      });
    } else {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: autolockTXID,
        description: "Enable autolock",
      });
    }

    const allowanceCallsPromises = [];

    // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
    if (!allowance) {
      const vestingNftContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const tokenPromise = new Promise<void>((resolve, reject) => {
        stores.stableSwapStore._callContractWait(
          vestingNftContract,
          "approve",
          [stratAddress, tokenID],
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

    // SUBMIT DELEAGTE TRANSACTION
    const voteManagerContract = new web3.eth.Contract(
      CONTRACTS.VOTE_MANAGER_ABI as unknown as AbiItem[],
      CONTRACTS.VOTE_MANAGER_ADDRESS
    );

    stores.stableSwapStore._callContractWait(
      voteManagerContract,
      "delegate",
      [tokenID],
      account,
      delegateTXID,
      (err) => {
        if (err) {
          return stores.emitter.emit(ACTIONS.ERROR, err);
        }

        if (autolock) {
          stores.stableSwapStore._callContractWait(
            voteManagerContract,
            "autoLock",
            [tokenID, true],
            account,
            autolockTXID,
            (err) => {
              if (err) {
                return stores.emitter.emit(ACTIONS.ERROR, err);
              }
              queryClient.invalidateQueries({
                queryKey: ["vests", "allNfts"],
              });
            }
          );
        }
      }
    );
  } catch (e) {
    console.error(e);
    stores.emitter.emit(ACTIONS.ERROR, e);
  }
};

export const useDelegate = () => {
  const queryClient = useQueryClient();
  const account = useAccount();
  return useMutation({
    mutationFn: (options: { tokenID?: string; autolock?: boolean }) =>
      delegate(queryClient, account, options.tokenID, options.autolock),
    // TODO this doesnt work because of the function specific, it uses promises inside promises which can lead to unexpected behaviour
    // temporary workaround is passing query client inside delegate and invalidation in _thisCallContractWrite callback
    // onSuccess: () =>
    //   queryClient.invalidateQueries({
    //     queryKey: ["vests", "allNfts"],
    //   }),
  });
};

const undelegate = async (
  queryClient: QueryClient,
  account: { address: `0x${string}` } | null,
  tokenID?: string
) => {
  try {
    if (!tokenID || tokenID === "0") {
      throw new Error("Invalid token ID");
    }

    const web3 = await stores.accountStore.getWeb3Provider();

    if (!web3) {
      throw new Error("No web3 provider");
    }
    if (!account) {
      throw new Error("No account provider");
    }

    let allowanceTXID = getTXUUID();
    let undelegateTXID = getTXUUID();

    stores.emitter.emit(ACTIONS.TX_ADDED, {
      title: `Undelegate your veNFT`,
      type: "Undelegate",
      verb: "Undelegated",
      transactions: [
        {
          uuid: allowanceTXID,
          description: `Checking your veNFT approval`,
          status: "WAITING",
        },
        {
          uuid: undelegateTXID,
          description: `Undelegating your veNFT`,
          status: "WAITING",
        },
      ],
    });

    const stratAddress = await viemClient.readContract({
      address: CONTRACTS.VOTE_MANAGER_ADDRESS,
      abi: CONTRACTS.VOTE_MANAGER_ABI,
      functionName: "tokenIdToStrat",
      args: [BigInt(tokenID)],
    });

    // CHECK ALLOWANCES AND SET TX DISPLAY
    const allowance = await getNFTAllowance(tokenID, stratAddress);
    if (allowance === null)
      throw new Error("Error getting approval in create vest");
    if (!allowance) {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: allowanceTXID,
        description: `Approve the vote manager contract to operate your NFT`,
      });
    } else {
      stores.emitter.emit(ACTIONS.TX_STATUS, {
        uuid: allowanceTXID,
        description: `NFT is approved to be operated by the vote manager`,
        status: "DONE",
      });
    }

    const allowanceCallsPromises = [];

    // SUBMIT REQUIRED ALLOWANCE TRANSACTIONS
    if (!allowance) {
      const vestingNftContract = new web3.eth.Contract(
        CONTRACTS.VE_TOKEN_ABI as unknown as AbiItem[],
        CONTRACTS.VE_TOKEN_ADDRESS
      );

      const tokenPromise = new Promise<void>((resolve, reject) => {
        stores.stableSwapStore._callContractWait(
          vestingNftContract,
          "approve",
          [stratAddress, tokenID],
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

    // SUBMIT DELEAGTE TRANSACTION
    const voteManagerContract = new web3.eth.Contract(
      CONTRACTS.VOTE_MANAGER_ABI as unknown as AbiItem[],
      CONTRACTS.VOTE_MANAGER_ADDRESS
    );

    stores.stableSwapStore._callContractWait(
      voteManagerContract,
      "undelegate",
      [tokenID],
      account,
      undelegateTXID,
      (err) => {
        if (err) {
          return stores.emitter.emit(ACTIONS.ERROR, err);
        }
        queryClient.invalidateQueries({
          queryKey: ["vests", "allNfts"],
        });
      }
    );
  } catch (e) {
    console.error(e);
    stores.emitter.emit(ACTIONS.ERROR, e);
  }
};

export const useUndelegate = () => {
  const queryClient = useQueryClient();
  const account = useAccount();
  return useMutation({
    mutationFn: (options: { tokenID?: string }) =>
      undelegate(queryClient, account, options.tokenID),
  });
};

const autolock = async (
  queryClient: QueryClient,
  account: { address: `0x${string}` } | null,
  tokenID: string,
  enable: boolean
) => {
  try {
    if (!tokenID || tokenID === "0") {
      throw new Error("Invalid token ID");
    }

    const web3 = await stores.accountStore.getWeb3Provider();

    if (!web3) {
      throw new Error("No web3 provider");
    }
    if (!account) {
      throw new Error("No account provider");
    }

    let autolockTXID = getTXUUID();

    stores.emitter.emit(ACTIONS.TX_ADDED, {
      title: `${enable ? "Enable" : "Disable"} autolock for your veNFT`,
      type: `${enable ? "Enable" : "Disable"}`,
      verb: `${enable ? "Enabled" : "Disabled"}`,
      transactions: [
        {
          uuid: autolockTXID,
          description: `${
            enable ? "Enabling" : "Disabling"
          } autolock for your veNFT`,
          status: "WAITING",
        },
      ],
    });

    const voteManagerContract = new web3.eth.Contract(
      CONTRACTS.VOTE_MANAGER_ABI as unknown as AbiItem[],
      CONTRACTS.VOTE_MANAGER_ADDRESS
    );

    stores.stableSwapStore._callContractWait(
      voteManagerContract,
      "autoLock",
      [tokenID, enable],
      account,
      autolockTXID,
      (err) => {
        if (err) {
          return stores.emitter.emit(ACTIONS.ERROR, err);
        }
        queryClient.invalidateQueries({
          queryKey: ["vests", "allNfts"],
        });
      }
    );
  } catch (e) {
    console.error(e);
    stores.emitter.emit(ACTIONS.ERROR, e);
  }
};

export const useAutolock = () => {
  const queryClient = useQueryClient();
  const account = useAccount();
  return useMutation({
    mutationFn: (options: { tokenID: string; enable: boolean }) =>
      autolock(queryClient, account, options.tokenID, options.enable),
  });
};

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
