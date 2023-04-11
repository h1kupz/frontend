import React, { useState, useMemo } from "react";
import {
  Skeleton,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Typography,
  Tooltip,
  Toolbar,
  IconButton,
  TextField,
  InputAdornment,
  Popper,
  Fade,
  Grid,
  Switch,
} from "@mui/material";
import { useRouter } from "next/router";
import BigNumber from "bignumber.js";
import {
  FilterList,
  Search,
  AddCircleOutline,
  WarningOutlined,
} from "@mui/icons-material";

import { formatCurrency } from "../../utils/utils";
import { Pair, hasGauge, isBaseAsset } from "../../stores/types/types";

const headCells = [
  { id: "pair", numeric: false, disablePadding: false, label: "Pair" },
  {
    id: "balance",
    numeric: true,
    disablePadding: false,
    label: "Wallet",
  },
  {
    id: "poolBalance",
    numeric: true,
    disablePadding: false,
    label: "My Pool Amount",
  },
  {
    id: "stakedBalance",
    numeric: true,
    disablePadding: false,
    label: "My Staked Amount",
  },
  {
    id: "poolAmount",
    numeric: true,
    disablePadding: false,
    label: "Total Pool Amount",
  },
  {
    id: "stakedAmount",
    numeric: true,
    disablePadding: false,
    label: "Total Pool Staked",
  },
  {
    id: "tvl",
    numeric: true,
    disablePadding: false,
    label: "TVL",
  },
  {
    id: "apr",
    numeric: true,
    disablePadding: false,
    label: "APR",
  },
  {
    id: "",
    numeric: true,
    disablePadding: false,
    label: "Actions",
  },
] as const;

type OrderBy = (typeof headCells)[number]["id"];

function EnhancedTableHead(props: {
  order: "asc" | "desc";
  orderBy: OrderBy;
  onRequestSort: (_e: React.MouseEvent<unknown>, property: OrderBy) => void;
}) {
  const { order, orderBy, onRequestSort } = props;
  const createSortHandler =
    (property: OrderBy) => (_e: React.MouseEvent<unknown>) => {
      onRequestSort(_e, property);
    };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            className={`border-b border-b-[rgba(104,108,122,0.2)] ${
              headCell.id === "tvl"
                ? "max-2xl:hidden"
                : headCell.id === "poolAmount" ||
                  headCell.id === "stakedAmount" ||
                  headCell.id === "balance" ||
                  headCell.id === "poolBalance"
                ? "max-md:hidden"
                : ""
            }`}
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={"normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              <Typography variant="h5" className="text-xs font-extralight">
                {headCell.label}
              </Typography>
              {orderBy === headCell.id ? (
                <span className="absolute top-5 m-[-1px] h-[1px] w-[1px] overflow-hidden text-clip border-0 border-none p-0">
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </span>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

const getLocalToggles = () => {
  let localToggles = {
    toggleActive: false,
    toggleActiveGauge: true,
    toggleVariable: true,
    toggleStable: true,
  };
  // get locally saved toggles
  try {
    const localToggleString = localStorage.getItem("solidly-pairsToggle-v1");
    if (localToggleString && localToggleString.length > 0) {
      localToggles = JSON.parse(localToggleString);
    }
  } catch (ex) {
    console.log(ex);
  }

  return localToggles;
};

interface PairsTableProps {
  pairs: Pair[];
}

interface PairsTableToolbarProps {
  setSearch: (search: string) => void;
  setToggleActive: (toggleActive: boolean) => void;
  setToggleActiveGauge: (toggleActiveGauge: boolean) => void;
  setToggleStable: (toggleStable: boolean) => void;
  setToggleVariable: (toggleVariable: boolean) => void;
}

const EnhancedTableToolbar = (props: PairsTableToolbarProps) => {
  const router = useRouter();

  const localToggles = getLocalToggles();

  const [search, setSearch] = useState("");
  const [toggleActive, setToggleActive] = useState(localToggles.toggleActive);
  const [toggleActiveGauge, setToggleActiveGauge] = useState(
    localToggles.toggleActiveGauge
  );
  const [toggleStable, setToggleStable] = useState(localToggles.toggleStable);
  const [toggleVariable, setToggleVariable] = useState(
    localToggles.toggleVariable
  );

  const onSearchChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    props.setSearch(event.target.value);
  };

  const onToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const localToggles = getLocalToggles();

    switch (event.target.name) {
      case "toggleActive":
        setToggleActive(event.target.checked);
        props.setToggleActive(event.target.checked);
        localToggles.toggleActive = event.target.checked;
        break;
      case "toggleActiveGauge":
        setToggleActiveGauge(event.target.checked);
        props.setToggleActiveGauge(event.target.checked);
        localToggles.toggleActiveGauge = event.target.checked;
        break;
      case "toggleStable":
        setToggleStable(event.target.checked);
        props.setToggleStable(event.target.checked);
        localToggles.toggleStable = event.target.checked;
        break;
      case "toggleVariable":
        setToggleVariable(event.target.checked);
        props.setToggleVariable(event.target.checked);
        localToggles.toggleVariable = event.target.checked;
        break;
      default:
    }

    // set locally saved toggles
    try {
      localStorage.setItem(
        "solidly-pairsToggle-v1",
        JSON.stringify(localToggles)
      );
    } catch (ex) {
      console.log(ex);
    }
  };

  const onCreate = () => {
    router.push("/liquidity/create");
  };

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const open = Boolean(anchorEl);
  const id = open ? "transitions-popper" : undefined;

  return (
    <Toolbar className="my-6 mx-0 p-0">
      <Grid container spacing={2}>
        <Grid item lg={2} md={2} sm={12} xs={12}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddCircleOutline />}
            size="large"
            className="w-full bg-[#272826] font-bold text-cantoGreen hover:bg-[rgb(19,44,60)]"
            onClick={onCreate}
          >
            <Typography className="text-base font-bold">
              Add Liquidity
            </Typography>
          </Button>
        </Grid>
        <Grid item lg={9} md={9} sm={10} xs={10}>
          <TextField
            className="flex w-full flex-[1]"
            variant="outlined"
            fullWidth
            placeholder="CANTO, MIM, 0x..."
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
        </Grid>
        <Grid item lg={1} md={true} sm={2} xs={2}>
          <Tooltip placement="top" title="Filter list">
            <IconButton
              onClick={handleClick}
              className="h-[94.5%] w-full rounded-lg border border-[rgba(126,153,176,0.3)] bg-[#272826] text-cantoGreen"
              aria-label="filter list"
            >
              <FilterList />
            </IconButton>
          </Tooltip>
        </Grid>
      </Grid>

      <Popper
        id={id}
        open={open}
        anchorEl={anchorEl}
        transition
        placement="bottom-end"
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <div className="mt-4 min-w-[300px] rounded-lg border border-[rgba(126,153,176,0.2)] bg-[#212b48] p-5 shadow-[0_10px_20px_0_rgba(0,0,0,0.2)]">
              <Typography
                className="mb-2 border-b border-b-[rgba(126,153,176,0.2)] pb-5"
                variant="h5"
              >
                List Filters
              </Typography>

              <Grid container spacing={0}>
                <Grid item lg={9} className="flex items-center">
                  <Typography className="text-sm" variant="body1">
                    My Deposits
                  </Typography>
                </Grid>
                <Grid item lg={3} className="text-right">
                  <Switch
                    color="primary"
                    checked={toggleActive}
                    name={"toggleActive"}
                    onChange={onToggle}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={0}>
                <Grid item lg={9} className="flex items-center">
                  <Typography className="text-sm" variant="body1">
                    Show Active Gauges
                  </Typography>
                </Grid>
                <Grid item lg={3} className="text-right">
                  <Switch
                    color="primary"
                    checked={toggleActiveGauge}
                    name={"toggleActiveGauge"}
                    onChange={onToggle}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={0}>
                <Grid item lg={9} className="flex items-center">
                  <Typography className="text-sm" variant="body1">
                    Show Stable Pools
                  </Typography>
                </Grid>
                <Grid item lg={3} className="text-right">
                  <Switch
                    color="primary"
                    checked={toggleStable}
                    name={"toggleStable"}
                    onChange={onToggle}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={0}>
                <Grid item lg={9} className="flex items-center">
                  <Typography className="text-sm" variant="body1">
                    Show Volatile Pools
                  </Typography>
                </Grid>
                <Grid item lg={3} className="text-right">
                  <Switch
                    color="primary"
                    checked={toggleVariable}
                    name={"toggleVariable"}
                    onChange={onToggle}
                  />
                </Grid>
              </Grid>
            </div>
          </Fade>
        )}
      </Popper>
    </Toolbar>
  );
};

export default function EnhancedTable({ pairs }: PairsTableProps) {
  const router = useRouter();

  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [orderBy, setOrderBy] = useState<OrderBy>("stakedBalance");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);

  const localToggles = getLocalToggles();

  const [search, setSearch] = useState("");
  const [toggleActive, setToggleActive] = useState(localToggles.toggleActive);
  const [toggleActiveGauge, setToggleActiveGauge] = useState(
    localToggles.toggleActiveGauge
  );
  const [toggleStable, setToggleStable] = useState(localToggles.toggleStable);
  const [toggleVariable, setToggleVariable] = useState(
    localToggles.toggleVariable
  );

  const handleRequestSort = (
    _e: React.MouseEvent<unknown>,
    property: OrderBy
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const onView = (pair: Pair) => {
    router.push(`/liquidity/${pair.address}`);
  };

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredPairs = useMemo(
    () =>
      pairs
        .filter((pair) => {
          if (
            pair.isAliveGauge === false &&
            pair.balance &&
            parseFloat(pair.balance) === 0 &&
            pair.gauge?.balance &&
            parseFloat(pair.gauge?.balance) === 0
          ) {
            return false;
          }
          return true;
        })
        .filter((pair) => {
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
        })
        .filter((pair) => {
          if (toggleStable !== true && pair.stable === true) {
            return false;
          }
          if (toggleVariable !== true && pair.stable === false) {
            return false;
          }
          if (toggleActiveGauge === true && !pair.gauge) {
            return false;
          }
          if (toggleActive === true) {
            if (
              (!pair.gauge?.balance || !BigNumber(pair.gauge?.balance).gt(0)) &&
              (!pair.balance || !BigNumber(pair.balance).gt(0))
            ) {
              return false;
            }
          }

          return true;
        }),
    [
      pairs,
      toggleActiveGauge,
      toggleActive,
      toggleStable,
      toggleVariable,
      search,
    ]
  );

  const sortedPairs = useMemo(
    () =>
      stableSort(filteredPairs, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [filteredPairs, order, orderBy, page, rowsPerPage]
  );

  const emptyRows = 5 - Math.min(5, filteredPairs.length - page * 5);

  if (pairs.length === 0 || !pairs) {
    return (
      <div className="w-full">
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="mb-3 mt-6"
        />
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="my-3"
        />
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="my-3"
        />
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="my-3"
        />
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="my-3"
        />
        <Skeleton
          variant="rectangular"
          width={"100%"}
          height={40}
          className="my-3"
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <EnhancedTableToolbar
        setSearch={setSearch}
        setToggleActive={setToggleActive}
        setToggleActiveGauge={setToggleActiveGauge}
        setToggleStable={setToggleStable}
        setToggleVariable={setToggleVariable}
      />
      <Paper
        elevation={0}
        className="flex w-full flex-col items-end border border-[rgba(126,153,176,0.2)]"
      >
        <TableContainer>
          <Table
            aria-labelledby="tableTitle"
            size={"medium"}
            aria-label="enhanced table"
          >
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {sortedPairs.map((row, index) => {
                if (!row) {
                  return null;
                }
                const labelId = `enhanced-table-checkbox-${index}`;

                return (
                  <TableRow
                    key={labelId}
                    className="hover:bg-[rgba(104,108,122,0.05)]"
                  >
                    <TableCell>
                      <div className="flex items-center">
                        <div className="relative flex h-9 w-[70px]">
                          <img
                            className="absolute top-0 left-0 rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                            src={
                              row && row.token0 && row.token0.logoURI
                                ? row.token0.logoURI
                                : ``
                            }
                            width="37"
                            height="37"
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLImageElement).onerror = null;
                              (e.target as HTMLImageElement).src =
                                "/tokens/unknown-logo.png";
                            }}
                          />
                          <img
                            className="absolute top-0 left-6 z-[1] rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                            src={
                              row && row.token1 && row.token1.logoURI
                                ? row.token1.logoURI
                                : ``
                            }
                            width="37"
                            height="37"
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLImageElement).onerror = null;
                              (e.target as HTMLImageElement).src =
                                "/tokens/unknown-logo.png";
                            }}
                          />
                        </div>
                        <div>
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                            noWrap
                          >
                            {row?.symbol}
                          </Typography>
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                            noWrap
                            color="textSecondary"
                          >
                            {row?.stable ? "Stable Pool" : "Volatile Pool"}
                          </Typography>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-md:hidden" align="right">
                      {row &&
                        row.token0 &&
                        "balance" in row.token0 &&
                        row.token0.balance && (
                          <div className="flex items-center justify-end max-md:block">
                            <Typography
                              variant="h2"
                              className="text-xs font-extralight"
                            >
                              {formatCurrency(row.token0.balance)}
                            </Typography>
                            <Typography
                              variant="h5"
                              className={`min-w-[40xp] text-xs font-extralight`}
                              color="textSecondary"
                            >
                              {row.token0.symbol}
                            </Typography>
                          </div>
                        )}
                      {!(
                        row &&
                        row.token0 &&
                        "balance" in row.token0 &&
                        row.token0.balance
                      ) && (
                        <div className="flex items-center justify-end max-md:block">
                          <Skeleton
                            variant="rectangular"
                            width={120}
                            height={16}
                            style={{ marginTop: "1px", marginBottom: "1px" }}
                          />
                        </div>
                      )}
                      {row &&
                        row.token1 &&
                        "balance" in row.token1 &&
                        row.token1.balance && (
                          <div className="flex items-center justify-end max-md:block">
                            <Typography
                              variant="h2"
                              className="text-xs font-extralight"
                            >
                              {formatCurrency(row.token1.balance)}
                            </Typography>
                            <Typography
                              variant="h5"
                              className={`min-w-[40xp] text-xs font-extralight`}
                              color="textSecondary"
                            >
                              {row.token1.symbol}
                            </Typography>
                          </div>
                        )}
                      {!(
                        row &&
                        row.token1 &&
                        "balance" in row.token1 &&
                        row.token1.balance
                      ) && (
                        <div className="flex items-center justify-end max-md:block">
                          <Skeleton
                            variant="rectangular"
                            width={120}
                            height={16}
                            style={{ marginTop: "1px", marginBottom: "1px" }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-md:hidden" align="right">
                      {row && row.balance && row.totalSupply && (
                        <>
                          <div className="flex items-center justify-end max-md:block">
                            <Typography
                              variant="h2"
                              className="text-xs font-extralight"
                            >
                              {formatCurrency(
                                BigNumber(row.balance)
                                  .div(row.totalSupply)
                                  .times(row.reserve0)
                              )}
                            </Typography>
                            <Typography
                              variant="h5"
                              className={`min-w-[40xp] text-xs font-extralight`}
                              color="textSecondary"
                            >
                              {row.token0.symbol}
                            </Typography>
                          </div>
                          <div className="flex items-center justify-end max-md:block">
                            <Typography
                              variant="h5"
                              className="text-xs font-extralight"
                            >
                              {formatCurrency(
                                BigNumber(row.balance)
                                  .div(row.totalSupply)
                                  .times(row.reserve1)
                              )}
                            </Typography>
                            <Typography
                              variant="h5"
                              className={`min-w-[40xp] text-xs font-extralight`}
                              color="textSecondary"
                            >
                              {row.token1.symbol}
                            </Typography>
                          </div>
                        </>
                      )}
                      {!(row && row.balance && row.totalSupply) && (
                        <div className="flex items-center justify-end max-md:block">
                          <Skeleton
                            variant="rectangular"
                            width={120}
                            height={16}
                            style={{ marginTop: "1px", marginBottom: "1px" }}
                          />
                        </div>
                      )}
                    </TableCell>
                    {row && hasGauge(row) && (
                      <TableCell align="right">
                        {row.gauge.reserve0 &&
                          row.gauge.reserve1 &&
                          row.gauge.balance &&
                          row.gauge.totalSupply && (
                            <>
                              <div className="flex items-center justify-end max-md:block">
                                <Typography
                                  variant="h2"
                                  className="text-xs font-extralight"
                                >
                                  {formatCurrency(
                                    BigNumber(row.gauge.balance)
                                      .div(row.gauge.totalSupply)
                                      .times(row.gauge.reserve0)
                                  )}
                                </Typography>
                                <Typography
                                  variant="h5"
                                  className={`min-w-[40xp] text-xs font-extralight`}
                                  color="textSecondary"
                                >
                                  {row.token0.symbol}
                                </Typography>
                              </div>
                              <div className="flex items-center justify-end max-md:block">
                                <Typography
                                  variant="h5"
                                  className="text-xs font-extralight"
                                >
                                  {formatCurrency(
                                    BigNumber(row.gauge.balance)
                                      .div(row.gauge.totalSupply)
                                      .times(row.gauge.reserve1)
                                  )}
                                </Typography>
                                <Typography
                                  variant="h5"
                                  className={`min-w-[40xp] text-xs font-extralight`}
                                  color="textSecondary"
                                >
                                  {row.token1.symbol}
                                </Typography>
                              </div>
                            </>
                          )}
                        {!(
                          row &&
                          row.gauge &&
                          row.gauge.balance &&
                          row.gauge.totalSupply
                        ) && (
                          <div className="flex items-center justify-end max-md:block">
                            <Skeleton
                              variant="rectangular"
                              width={120}
                              height={16}
                              style={{
                                marginTop: "1px",
                                marginBottom: "1px",
                              }}
                            />
                          </div>
                        )}
                      </TableCell>
                    )}
                    {!(row && row.gauge && row.gauge.address) && (
                      <TableCell align="right">
                        <Typography
                          variant="h2"
                          className="text-xs font-extralight"
                        >
                          Gauge not available
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell className="max-md:hidden" align="right">
                      {row && row.reserve0 && row.token0 && (
                        <div className="flex items-center justify-end max-md:block">
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {formatCurrency(row.reserve0)}
                          </Typography>
                          <Typography
                            variant="h5"
                            className={`min-w-[40xp] text-xs font-extralight`}
                            color="textSecondary"
                          >
                            {row.token0.symbol}
                          </Typography>
                        </div>
                      )}
                      {!(row && row.reserve0 && row.token0) && (
                        <div className="flex items-center justify-end max-md:block">
                          <Skeleton
                            variant="rectangular"
                            width={120}
                            height={16}
                            style={{ marginTop: "1px", marginBottom: "1px" }}
                          />
                        </div>
                      )}
                      {row && row.reserve1 && row.token1 && (
                        <div className="flex items-center justify-end max-md:block">
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {formatCurrency(row.reserve1)}
                          </Typography>
                          <Typography
                            variant="h5"
                            className={`min-w-[40xp] text-xs font-extralight`}
                            color="textSecondary"
                          >
                            {row.token1.symbol}
                          </Typography>
                        </div>
                      )}
                      {!(row && row.reserve1 && row.token1) && (
                        <div className="flex items-center justify-end max-md:block">
                          <Skeleton
                            variant="rectangular"
                            width={120}
                            height={16}
                            style={{ marginTop: "1px", marginBottom: "1px" }}
                          />
                        </div>
                      )}
                    </TableCell>
                    {row && row.gauge && row.gauge.address && (
                      <TableCell className="max-md:hidden" align="right">
                        {row &&
                          row.gauge &&
                          row.gauge.reserve0 &&
                          row.token0 && (
                            <div className="flex items-center justify-end max-md:block">
                              <Typography
                                variant="h2"
                                className="text-xs font-extralight"
                              >
                                {formatCurrency(row.gauge.reserve0)}
                              </Typography>
                              <Typography
                                variant="h5"
                                className={`min-w-[40xp] text-xs font-extralight`}
                                color="textSecondary"
                              >
                                {row.token0.symbol}
                              </Typography>
                            </div>
                          )}
                        {!(
                          row &&
                          row.gauge &&
                          row.gauge.reserve0 &&
                          row.token0
                        ) && (
                          <div className="flex items-center justify-end max-md:block">
                            <Skeleton
                              variant="rectangular"
                              width={120}
                              height={16}
                              style={{
                                marginTop: "1px",
                                marginBottom: "1px",
                              }}
                            />
                          </div>
                        )}
                        {row &&
                          row.gauge &&
                          row.gauge.reserve1 &&
                          row.token1 && (
                            <div className="flex items-center justify-end max-md:block">
                              <Typography
                                variant="h2"
                                className="text-xs font-extralight"
                              >
                                {formatCurrency(row.gauge.reserve1)}
                              </Typography>
                              <Typography
                                variant="h5"
                                className={`min-w-[40xp] text-xs font-extralight`}
                                color="textSecondary"
                              >
                                {row.token1.symbol}
                              </Typography>
                            </div>
                          )}
                        {!(
                          row &&
                          row.gauge &&
                          row.gauge.reserve1 &&
                          row.token1
                        ) && (
                          <div className="flex items-center justify-end max-md:block">
                            <Skeleton
                              variant="rectangular"
                              width={120}
                              height={16}
                              style={{
                                marginTop: "1px",
                                marginBottom: "1px",
                              }}
                            />
                          </div>
                        )}
                      </TableCell>
                    )}
                    {!(row && row.gauge && row.gauge.address) && (
                      <TableCell className="max-md:hidden" align="right">
                        <Typography
                          variant="h2"
                          className="text-xs font-extralight"
                        >
                          Gauge not available
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell className="max-2xl:hidden" align="right">
                      <Typography
                        variant="h2"
                        className="text-xs font-extralight"
                      >
                        {formatTVL(row.tvl)}
                      </Typography>
                    </TableCell>
                    {row && (row.apr !== undefined || row.apr !== null) && (
                      <TableCell align="right">
                        <Grid container spacing={0}>
                          <Grid item lg={10}>
                            <Typography
                              variant="h2"
                              className="text-xs font-extralight"
                            >
                              {row.apr.toFixed(2)}%
                            </Typography>
                          </Grid>
                          {row && row.isAliveGauge === false && (
                            <Grid item lg={2}>
                              <Tooltip title="Gauge has been killed">
                                <WarningOutlined className="ml-2 text-base text-yellow-300" />
                              </Tooltip>
                            </Grid>
                          )}
                        </Grid>
                      </TableCell>
                    )}
                    {!(row && (row.apr !== undefined || row.apr !== null)) && (
                      <div className="flex items-center justify-end max-md:block">
                        <Skeleton
                          variant="rectangular"
                          width={120}
                          height={16}
                          style={{
                            marginTop: "1px",
                            marginBottom: "1px",
                          }}
                        />
                      </div>
                    )}
                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                          onView(row);
                        }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {emptyRows > 0 && (
                <TableRow style={{ height: 61 * emptyRows }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredPairs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </div>
  );
}

function descendingComparator(a: Pair, b: Pair, orderBy: OrderBy) {
  if (!a || !b) {
    return 0;
  }

  switch (orderBy) {
    case "balance":
      if (
        !isBaseAsset(a.token0) ||
        !isBaseAsset(b.token0) ||
        a.token0.balance === null ||
        b.token0.balance === null ||
        !isBaseAsset(a.token1) ||
        !isBaseAsset(b.token1) ||
        a.token1.balance === null ||
        b.token1.balance === null
      ) {
        return 0;
      }
      let balanceA = BigNumber(a.token0.balance)
        .plus(a.token1.balance)
        .toNumber();
      let balanceB = BigNumber(b.token0.balance)
        .plus(b.token1.balance)
        .toNumber();

      if (BigNumber(balanceB).lt(balanceA)) {
        return -1;
      }
      if (BigNumber(balanceB).gt(balanceA)) {
        return 1;
      }
      return 0;

    case "apr":
      if (BigNumber(b?.apr).lt(a?.apr)) {
        return -1;
      }
      if (BigNumber(b?.apr).gt(a?.apr)) {
        return 1;
      }
      return 0;

    case "poolBalance":
      if (!a.balance || !b.balance) {
        return 0;
      }
      if (BigNumber(b.balance).lt(a.balance)) {
        return -1;
      }
      if (BigNumber(b.balance).gt(a.balance)) {
        return 1;
      }
      return 0;

    case "stakedBalance":
      if (!hasGauge(a)) {
        return 1;
      }

      if (!hasGauge(b)) {
        return -1;
      }

      if (!a.gauge.balance) {
        return 1;
      }
      if (!b.gauge.balance) {
        return -1;
      }

      if (BigNumber(b.gauge.balance).lt(a.gauge.balance)) {
        return -1;
      }
      if (BigNumber(b.gauge.balance).gt(a.gauge.balance)) {
        return 1;
      }
      return 0;

    case "tvl":
    case "poolAmount":
      let reserveA = a.tvl;
      let reserveB = b.tvl;

      if (reserveB < reserveA) {
        return -1;
      }
      if (reserveB > reserveA) {
        return 1;
      }
      return 0;

    case "stakedAmount":
      if (!hasGauge(a)) {
        return 1;
      }

      if (!hasGauge(b)) {
        return -1;
      }

      if (!a.gauge.reserve0 || !a.gauge.reserve1) {
        return 1;
      }
      if (!b.gauge.reserve0 || !b.gauge.reserve1) {
        return -1;
      }

      let reserveAA = BigNumber(a.gauge.reserve0)
        .plus(a.gauge.reserve1)
        .toNumber();
      let reserveBB = BigNumber(b.gauge.reserve0)
        .plus(b.gauge.reserve1)
        .toNumber();

      if (BigNumber(reserveBB).lt(reserveAA)) {
        return -1;
      }
      if (BigNumber(reserveBB).gt(reserveAA)) {
        return 1;
      }
      return 0;

    default:
      return 0;
  }
}

function getComparator(order: "asc" | "desc", orderBy: OrderBy) {
  return order === "desc"
    ? (a: Pair, b: Pair) => descendingComparator(a, b, orderBy)
    : (a: Pair, b: Pair) => -descendingComparator(a, b, orderBy);
}

function stableSort(array: Pair[], comparator: (a: Pair, b: Pair) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as const);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

function formatTVL(dataNumber: number) {
  if (dataNumber < 1_000) {
    return "< $1k";
  } else if (dataNumber < 1_000_000) {
    return "$" + (dataNumber / 1_000).toFixed(2) + "k";
  } else if (dataNumber < 1_000_000_000) {
    return "$" + (dataNumber / 1_000_000).toFixed(2) + "m";
  } else {
    return "$" + (dataNumber / 1_000_000_000).toFixed(2) + "b";
  }
}
