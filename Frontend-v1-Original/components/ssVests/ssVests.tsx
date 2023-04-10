import React, { useState, useEffect, useCallback } from "react";
import { Typography } from "@mui/material";

import classes from "./ssVests.module.css";

import VestsTable from "./ssVestsTable";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";
import { GovToken, VestNFT, VeToken } from "../../stores/types/types";

export default function ssVests() {
  const [, updateState] = useState<{}>();
  const forceUpdate = useCallback(() => updateState({}), []);

  const [vestNFTs, setVestNFTs] = useState<VestNFT[]>([]);
  const [govToken, setGovToken] = useState<GovToken | null>(null);
  const [veToken, setVeToken] = useState<VeToken | null>(null);

  useEffect(() => {
    const ssUpdated = async () => {
      setGovToken(stores.stableSwapStore.getStore("govToken"));
      setVeToken(stores.stableSwapStore.getStore("veToken"));

      const nfts = stores.stableSwapStore.getStore("vestNFTs");
      if (JSON.stringify(nfts) !== JSON.stringify(vestNFTs)) {
        setVestNFTs(nfts);
      }
    };

    ssUpdated();

    stores.emitter.on(ACTIONS.UPDATED, ssUpdated);
    return () => {
      stores.emitter.removeListener(ACTIONS.UPDATED, ssUpdated);
    };
  }, []);

  useEffect(() => {
    const vestNFTsReturned = (nfts: VestNFT[]) => {
      setVestNFTs(nfts);
      forceUpdate();
    };

    window.setTimeout(() => {
      stores.dispatcher.dispatch({ type: ACTIONS.GET_VEST_NFTS, content: {} });
    }, 1);

    const resetVestReturned = () => {
      stores.dispatcher.dispatch({ type: ACTIONS.GET_VEST_NFTS, content: {} });
    };

    stores.emitter.on(ACTIONS.VEST_NFTS_RETURNED, vestNFTsReturned);
    stores.emitter.on(ACTIONS.RESET_VEST_RETURNED, resetVestReturned);
    return () => {
      stores.emitter.removeListener(
        ACTIONS.VEST_NFTS_RETURNED,
        vestNFTsReturned
      );
      stores.emitter.removeListener(
        ACTIONS.RESET_VEST_RETURNED,
        resetVestReturned
      );
    };
  }, []);

  return (
    <div className={classes.container}>
      <div className={classes.descriptionBox}>
        <Typography variant="h1">Vest</Typography>
        <Typography variant="body2">
          Lock FLOW into veFLOW to earn and govern. Vote with veFLOW to earn
          bribes and trading fees. veFLOW can be transferred, merged and split.
          You can hold multiple positions.
        </Typography>
      </div>
      <VestsTable vestNFTs={vestNFTs} govToken={govToken} veToken={veToken} />
    </div>
  );
}
