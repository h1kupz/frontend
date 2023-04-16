import { useState } from "react";
import { Tooltip, Dialog } from "@mui/material";

import {
  useAverageNftDelegationAPR,
  useAverageStrategiesDelegationAPR,
  useDelegate,
  useUndelegate,
} from "./queries";

import { VestNFT } from "../../stores/types/types";

function VoteManagerDialog({
  open,
  onClose,
  nft,
}: {
  open: boolean;
  onClose: () => void;
  nft?: VestNFT;
}) {
  const [enableAutolock, setEnableAutolock] = useState(true);

  const { mutate: delegate } = useDelegate();
  const onDelegate = () => {
    delegate({ tokenID: nft?.id, autolock: enableAutolock });
    internalOnClose();
  };
  const { mutate: undelegate } = useUndelegate();

  const { isFetching: isFetchingAPR, data: apr } =
    useAverageStrategiesDelegationAPR(nft);

  const { isFetching: isFetchingAPROfNft, data: aprOfNft } =
    useAverageNftDelegationAPR(nft);

  if (!nft) {
    return null;
  }

  const internalOnClose = () => {
    setEnableAutolock(true);
    onClose();
  };

  return (
    <Dialog
      aria-labelledby="vote-manager-modal"
      open={open}
      onClose={internalOnClose}
      sx={{ "& .MuiDialog-paper": { all: "unset" } }}
    >
      <div className="w-96 max-w-md rounded-md bg-[#040105] p-5 shadow-glow">
        {nft.delegated ? (
          <>
            <div className="text-lg font-semibold">Undelegate NFT#{nft.id}</div>
            <div
              className={`font-sono text-lg ${
                isFetchingAPROfNft ? "animate-pulse" : ""
              }`}
            >
              NFT APR is {aprOfNft} %
            </div>
            <div>Revoke your voting power from Velocimeter.</div>
            <div className="flex flex-col gap-3">
              <div className="text-sm text-slate-300">
                <div>When you undelegate:</div>
                <ul>
                  <li>
                    -NFT will be able to vote in the current epoch, if
                    Velocimeter hasn&apos;t voted this epoch.
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex items-end justify-end">
              <button
                onClick={() => undelegate({ tokenID: nft.id })}
                className="border border-cantoGreen px-2 py-2 text-center text-sm font-medium text-cantoGreen transition-all duration-300 hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-green-200"
              >
                Undelegate
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold">Delegate NFT#{nft.id}</div>
            <div
              className={`font-sono text-lg ${
                isFetchingAPR ? "animate-pulse" : ""
              }`}
            >
              Average APR is {apr} %
            </div>
            <div>
              Grant Velocimeter your voting power to be used to collect bribes
              and auto compound into more veFLOW.
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-sm text-slate-300">
                <div>To Delegate:</div>
                <ul>
                  <li>-NFT must have minimum of 500 FLOW vested</li>
                  <li>-NFT must be locked for at least 7 more days</li>
                  <li>
                    -NFT will remain in your wallet, and can still be controlled
                    by the owner
                  </li>
                </ul>
              </div>
              <div className="flex items-end justify-between">
                <Tooltip
                  title="Autolock extends your veFLOW lock duration by 1 week every week to maintain
                  your voting power"
                  placement="left"
                >
                  <div
                    className="flex max-w-fit cursor-pointer items-center gap-1 text-sm"
                    onClick={() => setEnableAutolock((prev) => !prev)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setEnableAutolock((prev) => !prev);
                      }
                    }}
                  >
                    <div
                      className={`h-4 w-4 outline outline-1 outline-cantoGreen transition-colors ${
                        enableAutolock
                          ? "bg-cantoGreen outline-offset-1"
                          : "bg-transparent"
                      }`}
                    />
                    <div>
                      autolock {enableAutolock ? "enabled" : "disabled"}
                    </div>
                  </div>
                </Tooltip>
                <button
                  onClick={onDelegate}
                  className="border border-cantoGreen px-2 py-2 text-center text-sm font-medium text-cantoGreen transition-colors hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-green-200"
                >
                  Delegate
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

export default VoteManagerDialog;
