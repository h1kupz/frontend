import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { AbiItem } from "web3-utils";

import viemClient from "./connectors/viem";

import { ACTIONS, CONTRACTS, ZERO_ADDRESS } from "./constants/constants";
import stores from ".";

export type VoteManagerStore = {
  delegate: (tokenID: string, autolock?: boolean) => Promise<void>;
  undelegate: (tokenID: string) => Promise<void>;
  autolock: (tokenID: string, enable: boolean) => Promise<void>;
  _getNFTAllowance: (address: `0x${string}`) => Promise<boolean | null>;
  _getTXUUID: () => string;
  getAPR: () => Promise<number>;
  getAPROfNFT: (tokenID?: string) => Promise<number>;
};

const useVoteManagerStore = create<VoteManagerStore>((set, get) => ({
  delegate: async (tokenID, autolock) => {
    try {
      if (!tokenID || tokenID === "0") {
        throw new Error("Invalid token ID");
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      const account = stores.accountStore.getStore("account");

      if (!web3) {
        throw new Error("No web3 provider");
      }
      if (!account) {
        throw new Error("No account provider");
      }

      let allowanceTXID = get()._getTXUUID();
      let delegateTXID = get()._getTXUUID();
      let autolockTXID = get()._getTXUUID();

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

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await get()._getNFTAllowance(account.address);
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
            "setApprovalForAll",
            [CONTRACTS.VOTE_MANAGER_ADDRESS, tokenID],
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
              }
            );
          }

          stores.stableSwapStore._getGovTokenInfo(account);
          stores.stableSwapStore.getNFTByID("fetchAll");

          stores.emitter.emit(ACTIONS.DELEGATE_VEST_RETURNED);
        }
      );
    } catch (e) {
      console.error(e);
      stores.emitter.emit(ACTIONS.ERROR, e);
    }
  },
  undelegate: async (tokenID) => {
    try {
      if (!tokenID || tokenID === "0") {
        throw new Error("Invalid token ID");
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      const account = stores.accountStore.getStore("account");

      if (!web3) {
        throw new Error("No web3 provider");
      }
      if (!account) {
        throw new Error("No account provider");
      }

      let allowanceTXID = get()._getTXUUID();
      let undelegateTXID = get()._getTXUUID();

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

      // CHECK ALLOWANCES AND SET TX DISPLAY
      const allowance = await get()._getNFTAllowance(account.address);
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
            "setApprovalForAll",
            [CONTRACTS.VOTE_MANAGER_ADDRESS, tokenID],
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

          stores.stableSwapStore._getGovTokenInfo(account);
          stores.stableSwapStore.getNFTByID("fetchAll");

          stores.emitter.emit(ACTIONS.UNDELEGATE_VEST_RETURNED);
        }
      );
    } catch (e) {
      console.error(e);
      stores.emitter.emit(ACTIONS.ERROR, e);
    }
  },
  autolock: async (tokenID, enable) => {
    try {
      if (!tokenID || tokenID === "0") {
        throw new Error("Invalid token ID");
      }

      const web3 = await stores.accountStore.getWeb3Provider();
      const account = stores.accountStore.getStore("account");

      if (!web3) {
        throw new Error("No web3 provider");
      }
      if (!account) {
        throw new Error("No account provider");
      }

      let autolockTXID = get()._getTXUUID();

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

          stores.stableSwapStore._getVestNFTs(account);

          stores.emitter.emit(ACTIONS.AUTOLOCK_VEST_RETURNED);
        }
      );
    } catch (e) {
      console.error(e);
      stores.emitter.emit(ACTIONS.ERROR, e);
    }
  },
  _getNFTAllowance: async (address) => {
    try {
      const votingContract = {
        address: CONTRACTS.VE_TOKEN_ADDRESS,
        abi: CONTRACTS.VE_TOKEN_ABI,
      } as const;

      const isApproved = await viemClient.readContract({
        ...votingContract,
        functionName: "isApprovedForAll",
        args: [address, CONTRACTS.VOTE_MANAGER_ADDRESS],
      });

      return isApproved;
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  _getTXUUID: () => {
    return uuidv4();
  },
  getAPR: async () => {
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
  },
  getAPROfNFT: async (tokenID) => {
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
  },
}));

export default useVoteManagerStore;
