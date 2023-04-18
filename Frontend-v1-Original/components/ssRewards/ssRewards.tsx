import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Typography,
  Grid,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { AddCircleOutline } from "@mui/icons-material";

import RewardsTable from "./ssRewardsTable";
import { formatCurrency } from "../../utils/utils";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";

import {
  VeDistReward,
  VestNFT,
  VeToken,
  Gauge,
} from "../../stores/types/types";

const initialEmptyToken: VestNFT = {
  id: "0",
  lockAmount: "0",
  lockEnds: "0",
  lockValue: "0",
  voted: false,
  autolock: false,
  delegated: false,
};

export default function ssRewards() {
  const [, updateState] = useState<{}>();
  const forceUpdate = useCallback(() => updateState({}), []);

  const [rewards, setRewards] = useState<(Gauge | VeDistReward)[]>([]);
  const [vestNFTs, setVestNFTs] = useState<VestNFT[]>([]);
  const [token, setToken] = useState<VestNFT>(initialEmptyToken);
  const [veToken, setVeToken] = useState<VeToken | null>(null);
  const [loading, setLoading] = useState(false);

  const stableSwapUpdated = () => {
    const nfts = stores.stableSwapStore.getStore("vestNFTs");
    setVestNFTs(nfts);
    setVeToken(stores.stableSwapStore.getStore("veToken"));

    if (nfts && nfts.length > 0) {
      if (!token || token.lockEnds === "0") {
        setToken(nfts[0]);
        window.setTimeout(() => {
          stores.dispatcher.dispatch({
            type: ACTIONS.GET_REWARD_BALANCES,
            content: { tokenID: nfts[0].id },
          });
        });
      } else {
        window.setTimeout(() => {
          stores.dispatcher.dispatch({
            type: ACTIONS.GET_REWARD_BALANCES,
            content: { tokenID: token.id },
          });
        });
      }
    } else {
      window.setTimeout(() => {
        stores.dispatcher.dispatch({
          type: ACTIONS.GET_REWARD_BALANCES,
          content: { tokenID: 0 },
        });
      });
    }

    forceUpdate();
  };

  const rewardBalancesReturned = (
    rew?: (typeof stores.stableSwapStore)["store"]["rewards"]
  ) => {
    if (rew) {
      if (
        rew &&
        rew.bribes &&
        rew.rewards &&
        rew.veDist &&
        rew.bribes.length >= 0 &&
        rew.rewards.length >= 0
      ) {
        setRewards([...rew.bribes, ...rew.rewards, ...rew.veDist]);
      }
    } else {
      let re = stores.stableSwapStore.getStore("rewards");

      if (
        re &&
        re.bribes &&
        re.rewards &&
        re.veDist &&
        re.bribes.length >= 0 &&
        re.rewards.length >= 0
      ) {
        setRewards([...re.bribes, ...re.rewards, ...re.veDist]);
      }
    }
  };

  useEffect(() => {
    rewardBalancesReturned();
    stableSwapUpdated();

    stores.emitter.on(ACTIONS.UPDATED, stableSwapUpdated);
    stores.emitter.on(ACTIONS.REWARD_BALANCES_RETURNED, rewardBalancesReturned);
    return () => {
      stores.emitter.removeListener(ACTIONS.UPDATED, stableSwapUpdated);
      stores.emitter.removeListener(
        ACTIONS.REWARD_BALANCES_RETURNED,
        rewardBalancesReturned
      );
    };
  }, [token]);

  useEffect(() => {
    const claimReturned = () => {
      setLoading(false);
    };

    const claimAllReturned = () => {
      setLoading(false);
    };

    stableSwapUpdated();

    stores.emitter.on(ACTIONS.CLAIM_BRIBE_RETURNED, claimReturned);
    stores.emitter.on(ACTIONS.CLAIM_REWARD_RETURNED, claimReturned);
    // stores.emitter.on(ACTIONS.CLAIM_PAIR_FEES_RETURNED, claimReturned);
    stores.emitter.on(ACTIONS.CLAIM_VE_DIST_RETURNED, claimReturned);
    stores.emitter.on(ACTIONS.CLAIM_ALL_REWARDS_RETURNED, claimAllReturned);
    return () => {
      stores.emitter.removeListener(
        ACTIONS.CLAIM_BRIBE_RETURNED,
        claimReturned
      );
      stores.emitter.removeListener(
        ACTIONS.CLAIM_REWARD_RETURNED,
        claimReturned
      );
      stores.emitter.removeListener(
        ACTIONS.CLAIM_VE_DIST_RETURNED,
        claimReturned
      );
      stores.emitter.removeListener(
        ACTIONS.CLAIM_ALL_REWARDS_RETURNED,
        claimAllReturned
      );
    };
  }, []);

  const onClaimAll = () => {
    setLoading(true);
    let sendTokenID = 0;
    if (token && token.id) {
      sendTokenID = +token.id;
    }
    stores.dispatcher.dispatch({
      type: ACTIONS.CLAIM_ALL_REWARDS,
      content: { pairs: rewards, tokenID: sendTokenID },
    });
  };

  const handleChange = (event: SelectChangeEvent<VestNFT>) => {
    setToken(event.target.value as VestNFT);
    stores.dispatcher.dispatch({
      type: ACTIONS.GET_REWARD_BALANCES,
      content: { tokenID: (event.target.value as VestNFT).id },
    });
  };

  const renderMediumInput = (value: VestNFT, options: VestNFT[]) => {
    return (
      <div className="flex min-h-[60px] w-full flex-wrap items-center rounded-lg bg-[#272826] pl-5">
        <Grid container>
          <Grid item lg="auto" md="auto" sm={12} xs={12}>
            <Typography
              variant="body2"
              className="py-4 pr-2 text-[rgba(126,153,176,0.9)]"
            >
              Please select your veNFT:
            </Typography>
          </Grid>
          <Grid item lg={6} md={6} sm={12} xs={12}>
            <div className="h-full w-full min-w-[300px] flex-[1]">
              <Select
                fullWidth
                value={value}
                onChange={handleChange}
                // @ts-expect-error This is because of how material-ui works
                InputProps={{
                  style: {
                    "font-size": "32px !important",
                  },
                }}
                sx={{ "& .MuiSelect-select": { height: "inherit" } }}
              >
                {options &&
                  options.map((option) => {
                    return (
                      <MenuItem
                        key={option.id}
                        // ok at runtime if MenuItem is an immediate child of Select since value is transferred to data-value.
                        value={option as any}
                      >
                        <div className="flex w-[calc(100%-24px)] items-center justify-between">
                          <Typography>Token #{option.id}</Typography>
                          <div>
                            <Typography align="right" className="text-xs">
                              {formatCurrency(option.lockValue)}
                            </Typography>
                            <Typography
                              color="textSecondary"
                              className="text-xs"
                            >
                              {veToken?.symbol}
                            </Typography>
                          </div>
                        </div>
                      </MenuItem>
                    );
                  })}
              </Select>
            </div>
          </Grid>
        </Grid>
      </div>
    );
  };

  return (
    <div className="m-auto mb-5 flex w-[calc(100%-40px)] max-w-[1400px] flex-col items-end p-0 pt-20 pb-2 xl:mb-14 xl:w-[calc(100%-180px)] xl:pt-0">
      <div className="flex flex-col gap-1 self-start text-left">
        <Typography variant="h1">Rewards</Typography>
        <Typography variant="body2">
          Choose your veFLOW and claim your rewards.
        </Typography>
      </div>
      <div className="mb-6 flex w-full items-center justify-between">
        <Grid container spacing={1}>
          <Grid item lg="auto" md="auto" sm={12} xs={12}>
            <div>{renderMediumInput(token, vestNFTs)}</div>
          </Grid>
          <Grid item lg={true} md={true} sm={false} xs={false}>
            <div className="flex items-center justify-center">
              <Typography className="rounded-lg border border-cantoGreen bg-[#0e110c] p-5 text-xs font-extralight">
                Rewards are an estimation that aren't exact till the supply -
                {">"} rewardPerToken calculations have run
              </Typography>
            </div>
          </Grid>
          <Grid item lg="auto" md="auto" sm={12} xs={12}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddCircleOutline />}
              size="large"
              className="w-full bg-[#272826] font-bold text-cantoGreen hover:bg-[rgb(19,44,60)]"
              onClick={onClaimAll}
              disabled={loading}
            >
              <Typography className="text-base font-bold">Claim All</Typography>
            </Button>
          </Grid>
        </Grid>
      </div>
      <RewardsTable rewards={rewards} tokenID={token?.id} />
    </div>
  );
}
