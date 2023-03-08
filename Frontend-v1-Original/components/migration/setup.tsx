import React, { useState, useEffect } from "react";
import BigNumber from "bignumber.js";
import { Typography, Button, CircularProgress } from "@mui/material";
import { withTheme } from "@mui/styles";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";
import type { BaseAsset } from "../../stores/types/types";
import { formatCurrency } from "../../utils/utils";

const flowV1 = {
  address: "0x2Baec546a92cA3469f71b7A091f7dF61e5569889",
  balance: "0",
  chainId: 7700,
  decimals: 18,
  isWhitelisted: true,
  logoURI:
    "https://cre8r.vip/wp-content/uploads/2023/02/Flow-circle-aqua-150x150.png",
  name: "Flow v1",
  symbol: "FLOWv1",
  local: false,
};

function Setup() {
  const [, updateState] = React.useState<{}>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const [loading, setLoading] = useState(false);

  const [fromAmountValue, setFromAmountValue] = useState("");
  const [fromAmountError, setFromAmountError] = useState<false | string>(false);
  const [fromAssetValue, setFromAssetValue] = useState<BaseAsset>(flowV1);

  const [toAmountValue, setToAmountValue] = useState("");
  const [toAssetValue, setToAssetValue] = useState<BaseAsset>(null);

  useEffect(() => {
    const errorReturned = () => {
      setLoading(false);
    };

    const ssUpdated = () => {
      const swapAssets = stores.stableSwapStore.getStore("swapAssets");
      const v1Balance = stores.stableSwapStore.getStore("v1TokenBalance");
      if (v1Balance !== "0" && fromAssetValue.balance === "0") {
        setFromAssetValue({
          ...flowV1,
          balance: v1Balance,
        });
      }

      const swapAsset = swapAssets.find((asset) => asset.symbol === "FLOW");

      if (!!swapAsset) {
        setToAssetValue(swapAsset);
      }

      forceUpdate();
    };

    const redeemReturned = () => {
      setLoading(false);
      setFromAmountValue("");
      setToAmountValue("");
      calculateReceiveAmount("", fromAssetValue, toAssetValue);
    };

    stores.emitter.on(ACTIONS.ERROR, errorReturned);
    stores.emitter.on(ACTIONS.UPDATED, ssUpdated);
    stores.emitter.on(ACTIONS.REDEEM_RETURNED, redeemReturned);

    ssUpdated();

    return () => {
      stores.emitter.removeListener(ACTIONS.ERROR, errorReturned);
      stores.emitter.removeListener(ACTIONS.UPDATED, ssUpdated);
      stores.emitter.removeListener(ACTIONS.REDEEM_RETURNED, redeemReturned);
    };
  }, [fromAssetValue, toAssetValue]);

  const fromAmountChanged = (event) => {
    setFromAmountError(false);
    setFromAmountValue(event.target.value);
    if (event.target.value == "") {
      setToAmountValue("");
    } else {
      calculateReceiveAmount(event.target.value, fromAssetValue, toAssetValue);
    }
  };

  const toAmountChanged = (event) => {};

  const calculateReceiveAmount = (
    amount: string,
    from: BaseAsset,
    to: BaseAsset
  ) => {
    if (
      amount !== "" &&
      !isNaN(+amount) &&
      to != null &&
      parseFloat(amount) !== 0
    ) {
      setToAmountValue(amount);
    }
  };

  const onRedeem = () => {
    setFromAmountError(false);

    let error = false;

    if (!fromAmountValue || fromAmountValue === "" || isNaN(+fromAmountValue)) {
      setFromAmountError("From amount is required");
      error = true;
    } else {
      if (
        !fromAssetValue.balance ||
        isNaN(+fromAssetValue.balance) || // TODO probably dont neet it
        BigNumber(fromAssetValue.balance).lte(0)
      ) {
        setFromAmountError("Invalid balance");
        error = true;
      } else if (BigNumber(fromAmountValue).lt(0)) {
        setFromAmountError("Invalid amount");
        error = true;
      } else if (
        fromAssetValue &&
        BigNumber(fromAmountValue).gt(fromAssetValue.balance)
      ) {
        setFromAmountError(`Greater than your available balance`);
        error = true;
      }
    }

    if (!error) {
      setLoading(true);

      stores.dispatcher.dispatch({
        type: ACTIONS.REDEEM,
        content: {
          fromAmount: fromAmountValue,
        },
      });
    }
  };

  const setBalance100 = () => {
    const am = BigNumber(fromAssetValue.balance).toString();
    setFromAmountValue(am);
    calculateReceiveAmount(am, fromAssetValue, toAssetValue);
  };

  const renderMassiveInput = (
    type,
    amountValue,
    amountError: string | false,
    amountChanged,
    assetValue,
    version
  ) => {
    return (
      <div className="relative my-1">
        <div
          className="absolute top-2 right-2 z-[1] cursor-pointer"
          onClick={() => {
            if (type === "From") {
              setBalance100();
            }
          }}
        >
          <Typography
            className="mr-[6px] mt-[6px] text-xs font-normal text-[#7e99b0]"
            noWrap
          >
            Balance:
            {assetValue && assetValue.balance
              ? " " + formatCurrency(assetValue.balance)
              : ""}
          </Typography>
        </div>
        <div
          className={`flex w-full flex-wrap items-center rounded-lg bg-[#111] ${
            amountError && "border border-red-500"
          }`}
        >
          <div className="flex h-full min-h-[96px] w-32 items-center justify-center">
            {version === "v1" ? "FLOW v1" : "FLOW v2"}
          </div>
          <div className="h-full flex-1 grow-[0.98]">
            <input
              type="number"
              name={type}
              id={type}
              min={BigNumber(1).div(BigNumber(10).pow(18)).toNumber()}
              max={BigNumber(1).multipliedBy(BigNumber(10).pow(18)).toNumber()}
              placeholder="0.00"
              readOnly={type === "To"}
              disabled={loading}
              onChange={amountChanged}
              className="w-full rounded-xl border border-slate-500 bg-[#111] py-4 px-3 text-3xl text-white focus-visible:outline-none disabled:opacity-50"
              autoComplete="off"
              value={amountValue}
            />
            <div
              className={`${
                !!amountError
                  ? "absolute bottom-3 right-4 inline-block text-sm font-normal text-red-500"
                  : "hidden"
              }`}
            >
              {amountError ?? ""}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col">
      {renderMassiveInput(
        "From",
        fromAmountValue,
        fromAmountError,
        fromAmountChanged,
        fromAssetValue,
        "v1"
      )}
      {renderMassiveInput(
        "To",
        toAmountValue,
        false,
        toAmountChanged,
        toAssetValue,
        "v2"
      )}
      <div className="mt-2 flex h-full w-full flex-col gap-3">
        <Button
          variant="contained"
          size="large"
          color="primary"
          className="bg-[#272826] font-bold text-cantoGreen hover:bg-green-900"
          disabled={loading}
          onClick={onRedeem}
        >
          <Typography>{loading ? `Redeeming` : `Redeem`}</Typography>
          {loading && <CircularProgress size={10} />}
        </Button>
      </div>
    </div>
  );
}

export default withTheme(Setup);
