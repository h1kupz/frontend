import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Paper,
  Typography,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  MenuItem,
  Select,
  Grid,
} from "@mui/material";
import BigNumber from "bignumber.js";
import { Search } from "@mui/icons-material";
import { useRouter } from "next/router";

import classes from "./ssVotes.module.css";
import { formatCurrency } from "../../utils/utils";

import GaugesTable from "./ssVotesTable";
import WarningModal from "../warning/warning";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";
import {
  Gauge,
  hasGauge,
  VestNFT,
  VeToken,
  Vote,
  Votes,
} from "../../stores/types/types";
import { SelectChangeEvent } from "@mui/material";

const initialEmptyToken = {
  id: "0",
  lockAmount: "0",
  lockEnds: "0",
  lockValue: "0",
  voted: false,
  autolock: false,
  delegated: false,
};

export default function ssVotes() {
  const router = useRouter();

  const [showWarning, setShowWarning] = useState(false);

  // const [, updateState] = useState<{}>();
  // const forceUpdate = useCallback(() => updateState({}), []);

  const [gauges, setGauges] = useState<Gauge[]>([]);
  const [voteLoading, setVoteLoading] = useState(false);
  const [votes, setVotes] = useState<Votes>([]);
  const [veToken, setVeToken] = useState<VeToken | null>(null);
  const [token, setToken] = useState<VestNFT>(initialEmptyToken);
  const [vestNFTs, setVestNFTs] = useState<VestNFT[]>([]);
  const [search, setSearch] = useState("");

  const ssUpdated = () => {
    setVeToken(stores.stableSwapStore.getStore("veToken"));
    const as = stores.stableSwapStore.getStore("pairs");

    const filteredAssets = as.filter(hasGauge).filter((gauge) => {
      let sliderValue =
        votes.find((el) => el.address === gauge.address)?.value ?? 0;
      if (gauge.isAliveGauge === false && sliderValue === 0) {
        return false;
      }
      return true;
    });
    if (JSON.stringify(filteredAssets) !== JSON.stringify(gauges))
      setGauges(filteredAssets);

    const nfts = stores.stableSwapStore.getStore("vestNFTs");
    setVestNFTs(nfts);

    if (nfts && nfts.length > 0) {
      setToken(nfts[0]);
    }

    if (
      nfts &&
      nfts.length > 0 &&
      filteredAssets &&
      filteredAssets.length > 0
    ) {
      stores.dispatcher.dispatch({
        type: ACTIONS.GET_VEST_VOTES,
        content: { tokenID: nfts[0].id },
      });
      // stores.dispatcher.dispatch({
      //   type: ACTIONS.GET_VEST_BALANCES,
      //   content: { tokenID: nfts[0].id },
      // });
    }

    // forceUpdate();
  };

  useEffect(() => {
    const vestVotesReturned = (votesReturned: Vote[]) => {
      const votesReturnedMapped = votesReturned.map((vote) => {
        return {
          address: vote?.address,
          value: BigNumber(
            vote && vote.votePercent ? vote.votePercent : 0
          ).toNumber(),
        };
      });
      if (JSON.stringify(votesReturnedMapped) !== JSON.stringify(votes))
        setVotes(votesReturnedMapped);

      const pairs = stores.stableSwapStore.getStore("pairs");
      const filteredPairs = pairs.filter(hasGauge).filter((gauge) => {
        let sliderValue =
          votesReturnedMapped.find((el) => el.address === gauge.address)
            ?.value ?? 0;
        if (gauge.isAliveGauge === false && sliderValue === 0) {
          return false;
        }
        return true;
      });

      if (JSON.stringify(filteredPairs) !== JSON.stringify(gauges))
        setGauges(filteredPairs);

      // forceUpdate();
    };

    // const vestBalancesReturned = (vals) => {
    //   setGauges(vals);
    //   forceUpdate();
    // };

    const stableSwapUpdated = () => {
      ssUpdated();
    };

    const voteReturned = () => {
      setVoteLoading(false);
    };

    ssUpdated();

    // stores.dispatcher.dispatch({ type: ACTIONS.GET_VEST_NFTS, content: {} })

    stores.emitter.on(ACTIONS.UPDATED, stableSwapUpdated);
    stores.emitter.on(ACTIONS.VOTE_RETURNED, voteReturned);
    stores.emitter.on(ACTIONS.ERROR, voteReturned);
    stores.emitter.on(ACTIONS.VEST_VOTES_RETURNED, vestVotesReturned);
    // stores.emitter.on(ACTIONS.VEST_NFTS_RETURNED, vestNFTsReturned)
    // stores.emitter.on(ACTIONS.VEST_BALANCES_RETURNED, vestBalancesReturned);

    const localStorageWarningAccepted =
      window.localStorage.getItem("voting.warning");
    if (
      !localStorageWarningAccepted ||
      localStorageWarningAccepted !== "accepted"
    ) {
      setShowWarning(true);
      return;
    }
    setShowWarning(false);

    return () => {
      stores.emitter.removeListener(ACTIONS.UPDATED, stableSwapUpdated);
      stores.emitter.removeListener(ACTIONS.VOTE_RETURNED, voteReturned);
      stores.emitter.removeListener(ACTIONS.ERROR, voteReturned);
      stores.emitter.removeListener(
        ACTIONS.VEST_VOTES_RETURNED,
        vestVotesReturned
      );
      // stores.emitter.removeListener(ACTIONS.VEST_NFTS_RETURNED, vestNFTsReturned)
      // stores.emitter.removeListener(
      //   ACTIONS.VEST_BALANCES_RETURNED,
      //   vestBalancesReturned
      // );
    };
  }, []);

  const onVote = () => {
    setVoteLoading(true);
    stores.dispatcher.dispatch({
      type: ACTIONS.VOTE,
      content: { votes, tokenID: token.id },
    });
  };

  const acceptWarning = () => {
    window.localStorage.setItem("voting.warning", "accepted");
  };

  let totalVotes = votes.reduce((acc, curr) => {
    return (acc += curr.value);
  }, 0);

  const handleChange = (event: SelectChangeEvent<VestNFT>) => {
    setToken(event.target.value as VestNFT);
    stores.dispatcher.dispatch({
      type: ACTIONS.GET_VEST_VOTES,
      content: { tokenID: (event.target.value as VestNFT).id },
    });
  };

  const onSearchChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onBribe = () => {
    router.push("/bribe/create");
  };

  const renderMediumInput = (value: VestNFT, options: VestNFT[]) => {
    return (
      <div className={classes.textField}>
        <div className={classes.mediumInputContainer}>
          <Grid container>
            <Grid item lg="auto" md="auto" sm={12} xs={12}>
              <Typography variant="body2" className={classes.smallText}>
                Please select your veNFT:
              </Typography>
            </Grid>

            <Grid item lg={6} md={6} sm={12} xs={12}>
              <div className={classes.mediumInputAmount}>
                <Select
                  fullWidth
                  value={value}
                  onChange={handleChange}
                  // @ts-expect-error This is because of how material-ui works
                  InputProps={{
                    className: classes.mediumInput,
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
                          <div className={classes.menuOption}>
                            <Typography>Token #{option.id}</Typography>
                            <div>
                              <Typography
                                align="right"
                                className={classes.smallerText}
                              >
                                {formatCurrency(option.lockValue)}
                              </Typography>
                              <Typography
                                color="textSecondary"
                                className={classes.smallerText}
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
      </div>
    );
  };

  const filteredGauges = useMemo(
    () =>
      gauges.filter((pair) => {
        if (!search || search === "") {
          return true;
        }

        const searchLower = search.toLowerCase();

        if (
          pair.symbol.toLowerCase().includes(searchLower) ||
          pair.address.toLowerCase().includes(searchLower) ||
          pair.token0.symbol.toLowerCase().includes(searchLower) ||
          pair.token0.address.toLowerCase().includes(searchLower) ||
          pair.token0.name.toLowerCase().includes(searchLower) ||
          pair.token1.symbol.toLowerCase().includes(searchLower) ||
          pair.token1.address.toLowerCase().includes(searchLower) ||
          pair.token1.name.toLowerCase().includes(searchLower)
        ) {
          return true;
        }

        return false;
      }),
    [gauges, search]
  );

  const bribesAccrued = filteredGauges
    .reduce(
      (
        acc: number,
        row: {
          gauge: {
            tbv: number;
          };
        }
      ) => acc + row.gauge.tbv,
      0
    )
    .toFixed(2);

  return (
    <div className={classes.container}>
      <div className={classes.descriptionTimerBox}>
        <div className={classes.descriptionBox}>
          <Typography variant="h1">Vote</Typography>
          <Typography variant="body2">
            Select your veNFT and use 100% of your votes for one or more pools
            to earn bribes and trading fees (
            <span className="text-cantoGreen">
              ${formatCurrency(bribesAccrued)}
            </span>{" "}
            in total).
          </Typography>
        </div>
      </div>
      <div className={classes.topBarContainer}>
        <Grid container spacing={1}>
          {/* <Grid item lg='auto' sm={12} xs={12}>

              <Button
                variant="contained"
                color="secondary"
                className={classes.button}
                startIcon={<AddCircleOutlineIcon />}
                size='large'
                className={ classes.buttonOverride }
                color='primary'
                onClick={ onBribe }
              >
                <Typography className={ classes.actionButtonText }>{ `Create Bribe` }</Typography>
              </Button>

          </Grid> */}
          <Grid item lg={true} md={true} sm={12} xs={12}>
            <TextField
              className={classes.searchContainer}
              variant="outlined"
              fullWidth
              placeholder="CANTO, MIM, 0x..."
              value={search}
              onChange={onSearchChanged}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fill: "white" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item lg="auto" sm={12} xs={12}>
            <div className={classes.tokenIDContainer}>
              {renderMediumInput(token, vestNFTs)}
            </div>
          </Grid>
        </Grid>
      </div>
      <Paper elevation={0} className={classes.tableContainer}>
        <GaugesTable
          gauges={filteredGauges}
          setParentSliderValues={setVotes}
          defaultVotes={votes}
          token={token}
        />
      </Paper>
      <Paper elevation={10} className={classes.actionButtons}>
        <div className={classes.infoSection}>
          <Typography>Voting Power Used: </Typography>
          <Typography
            className={`${
              BigNumber(totalVotes).gt(100)
                ? classes.errorText
                : classes.helpText
            }`}
          >
            {totalVotes} %
          </Typography>
        </div>
        <div>
          <Button
            className={classes.buttonOverrideFixed}
            variant="contained"
            size="large"
            color="primary"
            disabled={
              voteLoading || !BigNumber(totalVotes).eq(100) || token.delegated
            }
            onClick={onVote}
          >
            <Typography className={classes.actionButtonText}>
              {voteLoading ? `Casting Votes` : `Cast Votes`}
            </Typography>
            {voteLoading && (
              <CircularProgress size={10} className={classes.loadingCircle} />
            )}
          </Button>
        </div>
      </Paper>
      {showWarning && (
        <WarningModal
          close={() => setShowWarning(false)}
          acceptWarning={acceptWarning}
        />
      )}
    </div>
  );
}
