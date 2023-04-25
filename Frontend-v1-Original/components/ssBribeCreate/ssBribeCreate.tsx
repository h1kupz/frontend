import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Dialog,
  MenuItem,
  IconButton,
  Select,
} from "@mui/material";
import { Search, ArrowBack, DeleteOutline } from "@mui/icons-material";
import BigNumber from "bignumber.js";
import { formatCurrency } from "../../utils/utils";
import classes from "./ssBribeCreate.module.css";

import stores from "../../stores";
import { ACTIONS, ETHERSCAN_URL } from "../../stores/constants/constants";
import { BaseAsset, Gauge, Pair, hasGauge } from "../../stores/types/types";
import { SelectChangeEvent } from "@mui/material";

export default function ssBribeCreate() {
  const router = useRouter();
  const [createLoading, setCreateLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | false>(false);
  const [asset, setAsset] = useState<BaseAsset | null>(null);
  const [assetOptions, setAssetOptions] = useState<BaseAsset[]>([]);
  const [gauge, setGauge] = useState<Gauge | null>(null);
  const [gaugeOptions, setGaugeOptions] = useState<Gauge[]>([]);

  const ssUpdated = async () => {
    const storeAssetOptions = stores.stableSwapStore.getStore("baseAssets");
    let filteredStoreAssetOptions = storeAssetOptions.filter((option) => {
      // @ts-expect-error this is a workaround for the CANTO token
      return option.address !== "CANTO";
    });
    const storePairs = stores.stableSwapStore.getStore("pairs");
    setAssetOptions(filteredStoreAssetOptions);

    const filteredPairs = storePairs
      .filter(hasGauge)
      .filter((gauge) => gauge.isAliveGauge);

    setGaugeOptions(filteredPairs);

    if (filteredStoreAssetOptions.length > 0 && asset == null) {
      setAsset(filteredStoreAssetOptions[0]);
    }

    if (filteredPairs.length > 0 && gauge == null) {
      const noteFlowPair = filteredPairs.filter((pair) => {
        return pair.symbol === "vAMM-NOTE/FLOW";
      });
      setGauge(noteFlowPair[0] ?? filteredPairs[0]);
    }
  };

  useEffect(() => {
    const createReturned = () => {
      setCreateLoading(false);
      setAmount("");

      onBack();
    };

    const errorReturned = () => {
      setCreateLoading(false);
    };

    const assetsUpdated = () => {
      const baseAsset = stores.stableSwapStore.getStore("baseAssets");
      let filteredStoreAssetOptions = baseAsset.filter((option) => {
        // @ts-expect-error this is a workaround for the CANTO token
        return option.address !== "CANTO";
      });
      setAssetOptions(filteredStoreAssetOptions);
    };

    stores.emitter.on(ACTIONS.UPDATED, ssUpdated);
    stores.emitter.on(ACTIONS.BRIBE_CREATED, createReturned);
    stores.emitter.on(ACTIONS.ERROR, errorReturned);
    stores.emitter.on(ACTIONS.BASE_ASSETS_UPDATED, assetsUpdated);

    ssUpdated();

    return () => {
      stores.emitter.removeListener(ACTIONS.UPDATED, ssUpdated);
      stores.emitter.removeListener(ACTIONS.BRIBE_CREATED, createReturned);
      stores.emitter.removeListener(ACTIONS.ERROR, errorReturned);
      stores.emitter.removeListener(ACTIONS.BASE_ASSETS_UPDATED, assetsUpdated);
    };
  }, []);

  const setAmountPercent = (input: string, percent: number) => {
    setAmountError(false);
    if (input === "amount" && asset && asset.balance) {
      let am = BigNumber(asset.balance)
        .times(percent)
        .div(100)
        .toFixed(asset.decimals);
      setAmount(am);
    }
  };

  const onCreate = () => {
    setAmountError(false);

    let error = false;

    if (!amount || amount === "" || isNaN(+amount)) {
      setAmountError("From amount is required");
      error = true;
    } else {
      if (
        !asset?.balance ||
        isNaN(+asset?.balance) ||
        BigNumber(asset?.balance).lte(0)
      ) {
        setAmountError("Invalid balance");
        error = true;
      } else if (BigNumber(amount).lt(0)) {
        setAmountError("Invalid amount");
        error = true;
      } else if (asset && BigNumber(amount).gt(asset.balance)) {
        setAmountError(`Greater than your available balance`);
        error = true;
      }
    }

    if (!asset || asset === null) {
      setAmountError("From asset is required");
      error = true;
    }

    if (!error) {
      setCreateLoading(true);
      stores.dispatcher.dispatch({
        type: ACTIONS.CREATE_BRIBE,
        content: {
          asset: asset,
          amount: amount,
          gauge: gauge,
        },
      });
    }
  };

  const amountChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAmountError(false);
    setAmount(event.target.value);
  };

  const onAssetSelect = (value: BaseAsset) => {
    setAmountError(false);
    setAsset(value);
  };

  const onGaugeSelect = (value: Gauge) => {
    setGauge(value);
  };

  const renderMassiveInput = (
    type: string,
    amountError: string | false,
    amountChanged: (event: React.ChangeEvent<HTMLInputElement>) => void,
    assetValue: BaseAsset | null,
    assetOptions: BaseAsset[],
    onAssetSelect: (value: BaseAsset) => void
  ) => {
    return (
      <div className={classes.textField}>
        <div className={classes.inputTitleContainer}>
          <div className={classes.inputBalance}>
            <Typography
              className={classes.inputBalanceText}
              noWrap
              onClick={() => {
                setAmountPercent(type, 100);
              }}
            >
              Balance:
              {assetValue && assetValue.balance
                ? " " + formatCurrency(assetValue.balance)
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
            <AssetSelect
              value={assetValue}
              assetOptions={assetOptions}
              onSelect={onAssetSelect}
            />
          </div>
          <div className={`${classes.massiveInputAmount} ${classes.p_4}`}>
            <TextField
              placeholder="0.00"
              fullWidth
              error={!!amountError}
              helperText={amountError}
              value={amount}
              onChange={amountChanged}
              disabled={createLoading}
              InputProps={{
                className: classes.largeInput,
              }}
            />
            <Typography color="textSecondary" className={classes.smallerText}>
              {asset?.symbol}
            </Typography>
          </div>
        </div>
      </div>
    );
  };

  const onBack = () => {
    router.back();
  };

  const renderCreateInfo = () => {
    return (
      <div className={classes.depositInfoContainer}>
        <Typography className={classes.depositInfoHeading}>
          You are creating a bribe of{" "}
          <span className={classes.highlight}>
            {formatCurrency(amount)} {asset?.symbol}
          </span>{" "}
          to incentivize Vesters to vote for the{" "}
          <span className={classes.highlight}>
            {gauge?.token0?.symbol}/{gauge?.token1?.symbol} Pool
          </span>
        </Typography>
      </div>
    );
  };

  return (
    <div className={classes.retain}>
      <Paper elevation={0} className={classes.container}>
        <div className={classes.titleSection}>
          <Tooltip placement="top" title="Back to Voting">
            <IconButton className={classes.backButton} onClick={onBack}>
              <ArrowBack className={classes.backIcon} />
            </IconButton>
          </Tooltip>
          <Typography className={classes.titleText}>Create Bribe</Typography>
        </div>
        <div className={classes.reAddPadding}>
          <div className={classes.inputsContainer}>
            <GaugeSelect
              value={gauge}
              gaugeOptions={gaugeOptions}
              onSelect={onGaugeSelect}
            />
            {renderMassiveInput(
              "amount",
              amountError,
              amountChanged,
              asset,
              assetOptions,
              onAssetSelect
            )}
            {renderCreateInfo()}
          </div>
          <div className={classes.actionsContainer}>
            <Button
              variant="contained"
              size="large"
              className={
                createLoading
                  ? classes.multiApprovalButton
                  : classes.buttonOverride
              }
              color="primary"
              disabled={createLoading}
              onClick={onCreate}
            >
              <Typography className={classes.actionButtonText}>
                {createLoading ? `Creating` : `Create Bribe`}
              </Typography>
              {createLoading && (
                <CircularProgress size={10} className={classes.loadingCircle} />
              )}
            </Button>
          </div>
        </div>
      </Paper>
    </div>
  );
}

function GaugeSelect({
  value,
  gaugeOptions,
  onSelect,
}: {
  value: Gauge | null;
  gaugeOptions: Gauge[];
  onSelect: (value: Gauge) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const openSearch = () => {
    setOpen(true);
    setSearch("");
  };

  const onClose = () => {
    setSearch("");
    setOpen(false);
  };

  const onSearchChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onLocalSelect = (gauge: Gauge) => {
    setSearch("");
    setOpen(false);
    onSelect(gauge);
  };

  const filteredGaugeOptions = useMemo(() => {
    const go = gaugeOptions.filter((gauge) => {
      if (search && search !== "") {
        return [gauge.address, gauge.token0.symbol, gauge.token1.symbol].some(
          (s) => s.toLowerCase().includes(search.trim().toLowerCase())
        );
      } else {
        return true;
      }
    });

    return go;
  }, [search, gaugeOptions]);

  return (
    <>
      <div
        className="relative mb-1 min-h-[100px] cursor-pointer rounded-lg border border-slate-500 p-3 transition-colors hover:border-slate-400"
        onClick={() => {
          openSearch();
        }}
      >
        <div className="flex w-[calc(100%-24px)] flex-col items-start py-2 px-3 md:flex-row md:items-center">
          <div className="relative box-content flex h-20 w-36 p-3">
            <img
              className="absolute left-0 top-[calc(50%-1.25rem)] h-10 rounded-full border-4 border-[#212b48] md:top-3 md:h-16"
              alt=""
              src={value && value.token0 ? `${value.token0.logoURI}` : ""}
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src = "/tokens/unknown-logo.png";
              }}
            />
            <img
              className="absolute left-8 top-[calc(50%-1.25rem)] z-10 h-10 rounded-full border-4 border-[#212b48] md:top-3 md:left-14 md:h-16"
              alt=""
              src={value && value.token1 ? `${value.token1.logoURI}` : ""}
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src = "/tokens/unknown-logo.png";
              }}
            />
          </div>
          <div>
            <Typography className="flex-[1] text-xl md:text-3xl">
              {value ? `${value.token0.symbol}/${value.token1.symbol}` : ""}
            </Typography>
            <Typography color="textSecondary" className="mt-1 text-xs">
              {value?.isStable ? "Stable Pool" : "Volatile Pool"}
            </Typography>
          </div>
        </div>
      </div>
      <Dialog
        onClose={onClose}
        aria-labelledby="simple-dialog-title"
        open={open}
      >
        <div className="h-[600px] overflow-y-scroll p-6">
          <TextField
            autoFocus
            variant="outlined"
            fullWidth
            placeholder="CANTO, NOTE, 0x..."
            value={search}
            onChange={onSearchChanged}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <div className="mt-3 flex w-full flex-col md:min-w-[512px]">
            {filteredGaugeOptions.map((option) => {
              return (
                <MenuItem
                  key={option.address}
                  // ok at runtime if MenuItem is an immediate child of Select since value is transferred to data-value.
                  value={option as any}
                  onClick={() => {
                    onLocalSelect(option);
                  }}
                >
                  <div className="flex w-[calc(100%-24px)] flex-col items-start py-2 px-3 md:flex-row md:items-center">
                    <div className="relative flex h-20 w-36 p-3">
                      <img
                        className="absolute left-0 top-[calc(50%-1.25rem)] h-10 rounded-full border-4 border-[#212b48] md:top-3 md:h-16"
                        alt=""
                        src={
                          option && option.token0
                            ? `${option.token0.logoURI}`
                            : ""
                        }
                        onError={(e) => {
                          (e.target as HTMLImageElement).onerror = null;
                          (e.target as HTMLImageElement).src =
                            "/tokens/unknown-logo.png";
                        }}
                      />
                      <img
                        className="absolute left-8 top-[calc(50%-1.25rem)] z-10 h-10 rounded-full border-4 border-[#212b48] md:top-3 md:left-14 md:h-16"
                        alt=""
                        src={
                          option && option.token1
                            ? `${option.token1.logoURI}`
                            : ""
                        }
                        onError={(e) => {
                          (e.target as HTMLImageElement).onerror = null;
                          (e.target as HTMLImageElement).src =
                            "/tokens/unknown-logo.png";
                        }}
                      />
                    </div>
                    <div>
                      <Typography className="flex-[1] text-xl md:text-3xl">
                        {option.token0.symbol}/{option.token1.symbol}
                      </Typography>
                      <Typography
                        color="textSecondary"
                        className="mt-1 text-xs"
                      >
                        {option?.isStable ? "Stable Pool" : "Volatile Pool"}
                      </Typography>
                    </div>
                  </div>
                </MenuItem>
              );
            })}
          </div>
        </div>
      </Dialog>
    </>
  );
}

function AssetSelect({
  value,
  assetOptions,
  onSelect,
}: {
  value: BaseAsset | null;
  assetOptions: BaseAsset[];
  onSelect: (value: BaseAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [manageLocal, setManageLocal] = useState(false);

  const openSearch = () => {
    setOpen(true);
    setSearch("");
  };

  const filteredAssetOptions = useMemo(() => {
    const ao = assetOptions.filter((asset) => {
      if (search && search !== "") {
        return [asset.address, asset.symbol, asset.name].some((s) =>
          s.toLowerCase().includes(search.trim().toLowerCase())
        );
      } else {
        return true;
      }
    });

    return ao;
  }, [assetOptions, search]);

  const onSearchChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onLocalSelect = (asset: BaseAsset) => {
    setSearch("");
    setManageLocal(false);
    setOpen(false);
    onSelect(asset);
  };

  const onClose = () => {
    setManageLocal(false);
    setSearch("");
    setOpen(false);
  };

  const toggleLocal = () => {
    setManageLocal(!manageLocal);
  };

  const deleteOption = (token: BaseAsset) => {
    stores.stableSwapStore.removeBaseAsset(token);
  };

  const viewOption = (token: BaseAsset) => {
    window.open(`${ETHERSCAN_URL}token/${token.address}`, "_blank");
  };

  const renderManageOption = (asset: BaseAsset, idx: number) => {
    return (
      <MenuItem
        key={asset.address + "_" + idx}
        className={classes.assetSelectMenu}
      >
        <div className={classes.assetSelectMenuItem}>
          <div className={classes.displayDualIconContainerSmall}>
            <img
              className={classes.displayAssetIconSmall}
              alt=""
              src={asset ? `${asset.logoURI}` : ""}
              height="60px"
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src = "/tokens/unknown-logo.png";
              }}
            />
          </div>
        </div>
        <div className={classes.assetSelectIconName}>
          <Typography variant="h5">{asset ? asset.symbol : ""}</Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {asset ? asset.name : ""}
          </Typography>
        </div>
        <div className={classes.assetSelectActions}>
          <IconButton
            onClick={() => {
              deleteOption(asset);
            }}
          >
            <DeleteOutline />
          </IconButton>
          <IconButton
            onClick={() => {
              viewOption(asset);
            }}
          >
            ↗
          </IconButton>
        </div>
      </MenuItem>
    );
  };

  const renderAssetOption = (asset: BaseAsset, idx: number) => {
    return (
      <MenuItem
        key={asset.address + "_" + idx}
        className={classes.assetSelectMenu}
        onClick={() => {
          onLocalSelect(asset);
        }}
      >
        <div className={classes.assetSelectMenuItem}>
          <div className={classes.displayDualIconContainerSmall}>
            <img
              className={classes.displayAssetIconSmall}
              alt=""
              src={asset ? `${asset.logoURI}` : ""}
              height="60px"
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src = "/tokens/unknown-logo.png";
              }}
            />
          </div>
        </div>
        <div className={classes.assetSelectIconName}>
          <Typography variant="h5">{asset ? asset.symbol : ""}</Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {asset ? asset.name : ""}
          </Typography>
        </div>
        <div className={classes.assetSelectBalance}>
          <Typography variant="h5">
            {asset && asset.balance ? formatCurrency(asset.balance) : "0.00"}
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {"Balance"}
          </Typography>
        </div>
      </MenuItem>
    );
  };

  const renderManageLocal = () => {
    return (
      <>
        <div className={classes.searchContainer}>
          <div className={classes.searchInline}>
            <TextField
              autoFocus
              variant="outlined"
              fullWidth
              placeholder="CANTO, NOTE, 0x..."
              value={search}
              onChange={onSearchChanged}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <div className={classes.assetSearchResults}>
            {filteredAssetOptions
              ? filteredAssetOptions
                  .filter((option) => {
                    return option.local === true;
                  })
                  .map((asset, idx) => {
                    return renderManageOption(asset, idx);
                  })
              : []}
          </div>
        </div>
        <div className={classes.manageLocalContainer}>
          <Button onClick={toggleLocal}>Back to Assets</Button>
        </div>
      </>
    );
  };

  const renderOptions = () => {
    return (
      <>
        <div className={classes.searchContainer}>
          <TextField
            autoFocus
            variant="outlined"
            fullWidth
            placeholder="CANTO, NOTE, 0x..."
            value={search}
            onChange={onSearchChanged}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <div className={classes.assetSearchResults}>
            {filteredAssetOptions
              ? filteredAssetOptions
                  .sort((a, b) => {
                    if (!a.balance || !b.balance) return 0;
                    if (BigNumber(a.balance).lt(b.balance)) return 1;
                    if (BigNumber(a.balance).gt(b.balance)) return -1;
                    if (a.symbol.toLowerCase() < b.symbol.toLowerCase())
                      return -1;
                    if (a.symbol.toLowerCase() > b.symbol.toLowerCase())
                      return 1;
                    return 0;
                  })
                  .map((asset, idx) => {
                    return renderAssetOption(asset, idx);
                  })
              : []}
          </div>
        </div>
        <div className={classes.manageLocalContainer}>
          <Button onClick={toggleLocal}>Manage Local Assets</Button>
        </div>
      </>
    );
  };

  return (
    <>
      <div
        className={classes.displaySelectContainer}
        onClick={() => {
          openSearch();
        }}
      >
        <div className={classes.assetSelectMenuItem}>
          <div className={classes.displayDualIconContainer}>
            <img
              className={classes.displayAssetIcon}
              alt=""
              src={value ? `${value.logoURI}` : ""}
              height="100px"
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src = "/tokens/unknown-logo.png";
              }}
            />
          </div>
        </div>
      </div>
      <Dialog
        onClose={onClose}
        aria-labelledby="simple-dialog-title"
        open={open}
      >
        {!manageLocal && renderOptions()}
        {manageLocal && renderManageLocal()}
      </Dialog>
    </>
  );
}
