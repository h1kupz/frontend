import { useState } from "react";
import { useRouter } from "next/router";
import { Paper, Typography, IconButton } from "@mui/material";
import classes from "./ssVest.module.css";
import moment from "moment";
import BigNumber from "bignumber.js";

import { ArrowBack } from "@mui/icons-material";

import LockAmount from "./lockAmount";
import LockDuration from "./lockDuration";
import VestingInfo from "./vestingInfo";
import { GovToken, VestNFT, VeToken } from "../../stores/types/types";

export default function existingLock({
  nft,
  govToken,
  veToken,
}: {
  nft: VestNFT;
  govToken: GovToken | null;
  veToken: VeToken | null;
}) {
  const [futureNFT, setFutureNFT] = useState<VestNFT | null>(null);

  const router = useRouter();

  const onBack = () => {
    router.push("/vest");
  };

  const updateLockAmount = (amount: string) => {
    if (amount === "") {
      let tmpNFT: VestNFT = {
        id: "future",
        lockAmount: nft.lockAmount,
        lockValue: nft.lockValue,
        lockEnds: nft.lockEnds,
        actionedInCurrentEpoch: nft.actionedInCurrentEpoch,
        reset: nft.reset,
        lastVoted: nft.lastVoted,
      };

      setFutureNFT(tmpNFT);
      return;
    }

    let tmpNFT: VestNFT = {
      id: "future",
      lockAmount: nft.lockAmount,
      lockValue: nft.lockValue,
      lockEnds: nft.lockEnds,
      actionedInCurrentEpoch: nft.actionedInCurrentEpoch,
      reset: nft.reset,
      lastVoted: nft.lastVoted,
    };

    const now = moment();
    const expiry = moment.unix(+tmpNFT.lockEnds);
    const dayToExpire = expiry.diff(now, "days");

    tmpNFT.lockAmount = BigNumber(nft.lockAmount).plus(amount).toFixed(18);
    tmpNFT.lockValue = BigNumber(tmpNFT.lockAmount)
      .times(parseInt(dayToExpire.toString()) + 1)
      .div(1460)
      .toFixed(18);

    setFutureNFT(tmpNFT);
  };

  const updateLockDuration = (val: string) => {
    let tmpNFT: VestNFT = {
      id: "future",
      lockAmount: nft.lockAmount,
      lockValue: nft.lockValue,
      lockEnds: nft.lockEnds,
      actionedInCurrentEpoch: nft.actionedInCurrentEpoch,
      reset: nft.reset,
      lastVoted: nft.lastVoted,
    };

    const now = moment();
    const expiry = moment(val);
    const dayToExpire = expiry.diff(now, "days");

    tmpNFT.lockEnds = expiry.unix().toString();
    tmpNFT.lockValue = BigNumber(tmpNFT.lockAmount)
      .times(parseInt(dayToExpire.toString()))
      .div(1460)
      .toFixed(18);

    setFutureNFT(tmpNFT);
  };

  return (
    <Paper elevation={0} className={classes.container2}>
      <div className={classes.titleSection}>
        <IconButton className={classes.backButton} onClick={onBack}>
          <ArrowBack className={classes.backIcon} />
        </IconButton>
        <Typography className={classes.titleText}>
          Manage Existing Lock
        </Typography>
      </div>
      <LockAmount
        nft={nft}
        govToken={govToken}
        updateLockAmount={updateLockAmount}
      />
      <LockDuration nft={nft} updateLockDuration={updateLockDuration} />
      <VestingInfo
        currentNFT={nft}
        futureNFT={futureNFT || undefined}
        veToken={veToken}
        showVestingStructure={false}
        govToken={govToken}
      />
    </Paper>
  );
}
