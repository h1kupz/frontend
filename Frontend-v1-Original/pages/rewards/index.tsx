import { useState, useEffect } from "react";
import { Typography, Button, Paper } from "@mui/material";

import SSRewards from "../../components/ssRewards/ssRewards";
import Unlock from "../../components/unlock/unlockModal";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function Rewards() {
  const accountStore = stores.accountStore.getStore("account");
  const [account, setAccount] = useState(accountStore);

  return (
    <div className="relative mt-0 flex h-full w-full flex-col pt-8">
      {account && account.address ? (
        <div>
          <SSRewards />
        </div>
      ) : (
        <Paper className="fixed top-0 flex h-[calc(100%-150px)] w-[calc(100%-80px)] flex-col flex-wrap items-center justify-center bg-[rgba(17,23,41,0.2)] p-12 text-center shadow-none max-lg:my-auto max-lg:mt-24 max-lg:mb-0 lg:h-[100vh] lg:w-full">
          <div className="relative z-10">
            <Typography
              className="text-center font-['Monument'] text-2xl font-thin text-white sm:text-3xl"
              variant="h1"
            >
              Rewards
            </Typography>
            <Typography
              className="color-[#7e99b0] my-7 mx-auto max-w-3xl text-center text-base sm:text-lg"
              variant="body2"
            >
              Claim your share of rewards!
            </Typography>
            <ConnectButton />
          </div>
        </Paper>
      )}
    </div>
  );
}

export default Rewards;
