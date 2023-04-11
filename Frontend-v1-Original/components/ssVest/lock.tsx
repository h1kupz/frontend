import { useState, useEffect, useRef } from "react";
import {
  Paper,
  Typography,
  Button,
  TextField,
  CircularProgress,
  RadioGroup,
  Radio,
  FormControlLabel,
  Tooltip,
  IconButton,
} from "@mui/material";
import { useRouter } from "next/router";
import BigNumber from "bignumber.js";
import moment from "moment";
import { formatCurrency } from "../../utils/utils";
import classes from "./ssVest.module.css";
import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";

import { ArrowBack } from "@mui/icons-material";
import VestingInfo from "./vestingInfo";
import { GovToken, VeToken } from "../../stores/types/types";
import { lockOptions } from "./lockDuration";

export default function ssLock({
  govToken,
  veToken,
}: {
  govToken: GovToken | null;
  veToken: VeToken | null;
}) {
  const inputEl = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const [lockLoading, setLockLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | false>(false);
  const [selectedValue, setSelectedValue] = useState<string | null>("8"); // select 1 week by default
  const [selectedDate, setSelectedDate] = useState(
    moment().add(7, "days").format("YYYY-MM-DD")
  );
  const [selectedDateError, setSelectedDateError] = useState(false);

  useEffect(() => {
    const lockReturned = () => {
      setLockLoading(false);
      router.push("/vest");
    };
    const errorReturned = () => {
      setLockLoading(false);
    };

    stores.emitter.on(ACTIONS.ERROR, errorReturned);
    stores.emitter.on(ACTIONS.CREATE_VEST_RETURNED, lockReturned);
    return () => {
      stores.emitter.removeListener(ACTIONS.ERROR, errorReturned);
      stores.emitter.removeListener(ACTIONS.CREATE_VEST_RETURNED, lockReturned);
    };
  }, []);

  const setAmountPercent = (percent: number) => {
    setAmount(
      BigNumber(govToken?.balance || 0)
        .times(percent)
        .div(100)
        .toFixed(govToken?.decimals ?? 18)
    );
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
    setSelectedValue(null);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedValue(event.target.value);

    let days = +event.target.value ?? 0;
    const newDate = moment().add(days, "days").format("YYYY-MM-DD");

    setSelectedDate(newDate);
  };

  const onLock = () => {
    setAmountError(false);

    let error = false;

    if (!amount || amount === "" || isNaN(+amount)) {
      setAmountError("Amount is required");
      error = true;
    } else {
      if (
        !govToken?.balance ||
        isNaN(+govToken?.balance) ||
        BigNumber(govToken?.balance).lte(0)
      ) {
        setAmountError("Invalid balance");
        error = true;
      } else if (BigNumber(amount).lte(0)) {
        setAmountError("Invalid amount");
        error = true;
      } else if (govToken && BigNumber(amount).gt(govToken.balance)) {
        setAmountError(`Greater than your available balance`);
        error = true;
      }
    }

    if (!error) {
      setLockLoading(true);

      const now = moment();
      const expiry = moment(selectedDate).add(1, "days");
      const secondsToExpire = expiry.diff(now, "seconds");

      stores.dispatcher.dispatch({
        type: ACTIONS.CREATE_VEST,
        content: { amount, unlockTime: secondsToExpire },
      });
    }
  };

  const focus = () => {
    inputEl.current?.focus();
  };

  const onAmountChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAmountError(false);
    setAmount(event.target.value);
  };

  const renderMassiveDateInput = (
    amountValue: string,
    amountError: boolean,
    amountChanged: (event: React.ChangeEvent<HTMLInputElement>) => void
  ) => {
    return (
      <div className={classes.textField}>
        <div
          className={`${classes.massiveInputContainer} ${
            amountError && classes.error
          }`}
        >
          <div className={classes.massiveInputAssetSelect}>
            <div className={classes.displaySelectContainer}>
              <div className={classes.assetSelectMenuItem}>
                <div className={classes.displayDualIconContainer}>
                  <div
                    className={classes.displayAssetIcon}
                    onClick={focus}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div className={classes.massiveInputAmount}>
            <TextField
              inputRef={inputEl}
              id="someDate"
              type="date"
              placeholder="Expiry Date"
              fullWidth
              error={amountError}
              helperText={amountError}
              value={amountValue}
              onChange={amountChanged}
              disabled={lockLoading}
              inputProps={{
                min: moment().add(7, "days").format("YYYY-MM-DD"),
                max: moment().add(1460, "days").format("YYYY-MM-DD"),
              }}
              InputProps={{
                className: classes.largeInput,
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderMassiveInput = (
    amountValue: string,
    amountError: string | false,
    amountChanged: (event: React.ChangeEvent<HTMLInputElement>) => void,
    token: GovToken | null
  ) => {
    return (
      <div className={classes.textField}>
        <div className={classes.inputTitleContainer}>
          <div className={classes.inputBalance}>
            <Typography
              className={classes.inputBalanceText}
              noWrap
              onClick={() => {
                setAmountPercent(100);
              }}
            >
              Balance:{" "}
              {token && token.balance
                ? " " + formatCurrency(token.balance)
                : ""}
            </Typography>
          </div>
        </div>
        <div
          className={`${classes.massiveInputContainer} ${
            amountError && classes.error
          }`}
        >
          <div className={classes.massiveInputAssetSelect}>
            <div className={classes.displaySelectContainer}>
              <div className={classes.assetSelectMenuItem}>
                <div className={classes.displayDualIconContainer}>
                  {token && token.logoURI && (
                    <img
                      className={classes.displayAssetIcon}
                      alt=""
                      src={token.logoURI}
                      height="100px"
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src =
                          "/tokens/unknown-logo.png";
                      }}
                    />
                  )}
                  {!(token && token.logoURI) && (
                    <img
                      className={classes.displayAssetIcon}
                      alt=""
                      src={"/tokens/unknown-logo.png"}
                      height="100px"
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src =
                          "/tokens/unknown-logo.png";
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className={classes.massiveInputAmount}>
            <TextField
              placeholder="0.00"
              fullWidth
              error={!!amountError}
              helperText={amountError}
              value={amountValue}
              onChange={amountChanged}
              disabled={lockLoading}
              InputProps={{
                className: classes.largeInput,
              }}
            />
            <Typography color="textSecondary" className={classes.smallerText}>
              {token?.symbol}
            </Typography>
          </div>
        </div>
      </div>
    );
  };

  const renderVestInformation = () => {
    const now = moment();
    const expiry = moment(selectedDate);
    const dayToExpire = expiry.diff(now, "days");

    const tmpNFT = {
      id: "future",
      lockAmount: amount,
      lockValue: BigNumber(amount)
        .times(parseInt(dayToExpire.toString()) + 1)
        .div(1460)
        .toFixed(18),
      lockEnds: expiry.unix().toString(),
      voted: false,
      delegated: false,
      autolock: false,
    };

    return (
      <VestingInfo
        futureNFT={tmpNFT}
        govToken={govToken}
        veToken={veToken}
        showVestingStructure={true}
      />
    );
  };

  const onBack = () => {
    router.push("/vest");
  };

  return (
    <>
      <Paper elevation={0} className={classes.container3}>
        <div className={classes.titleSection}>
          <Tooltip title="Back to Vest" placement="top">
            <IconButton className={classes.backButton} onClick={onBack}>
              <ArrowBack className={classes.backIcon} />
            </IconButton>
          </Tooltip>
          <Typography className={classes.titleText}>Create New Lock</Typography>
        </div>
        {renderMassiveInput(amount, amountError, onAmountChanged, govToken)}
        <div>
          {renderMassiveDateInput(
            selectedDate,
            selectedDateError,
            handleDateChange
          )}
          <div className={classes.inline}>
            <Typography className={classes.expiresIn}>Expires: </Typography>
            <RadioGroup
              className={`${classes.vestPeriodToggle} grid grid-cols-2`}
              onChange={handleChange}
              value={selectedValue}
            >
              {Object.keys(lockOptions).map((key) => {
                return (
                  <FormControlLabel
                    key={key}
                    className={classes.vestPeriodLabel}
                    value={lockOptions[key]}
                    control={<Radio color="primary" />}
                    label={key}
                    labelPlacement="end"
                  />
                );
              })}
            </RadioGroup>
          </div>
        </div>
        {renderVestInformation()}
        <div className={classes.actionsContainer}>
          <Button
            className={classes.buttonOverride}
            fullWidth
            variant="contained"
            size="large"
            color="primary"
            disabled={lockLoading}
            onClick={onLock}
          >
            <Typography className={classes.actionButtonText}>
              {lockLoading ? `Locking` : `Lock`}
            </Typography>
            {lockLoading && (
              <CircularProgress size={10} className={classes.loadingCircle} />
            )}
          </Button>
        </div>
      </Paper>
      <br />
      <br />
    </>
  );
}
