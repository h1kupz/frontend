import { type QueryClient, useQueryClient, useMutation } from "react-query";
import type { AbiItem } from "web3-utils";

import { useGovToken, useVeToken, useVestNfts } from "./queries";
import { useAccount } from "../../hooks/useAccount";
import { getRewardBalances } from "../ssRewards/queries";
import stores from "../../stores";
import { CONTRACTS, ACTIONS } from "../../stores/constants/constants";
import { Bribe, GovToken, VeToken, VestNFT } from "../../stores/types/types";
import { getTXUUID } from "../../utils/utils";

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
