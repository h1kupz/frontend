import React, { useState } from "react";

import {
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
  Skeleton,
} from "@mui/material";
import BigNumber from "bignumber.js";

import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";
import { formatCurrency } from "../../utils/utils";
import { Gauge, VeDistReward, isGaugeReward } from "../../stores/types/types";

const headCells = [
  { id: "reward", numeric: false, disablePadding: false, label: "Pool" },
  {
    id: "balance",
    numeric: true,
    disablePadding: false,
    label: "Your Position",
  },
  {
    id: "earned",
    numeric: true,
    disablePadding: false,
    label: "You Earned",
  },
  {
    id: "bruh",
    numeric: true,
    disablePadding: false,
    label: "Actions",
  },
] as const;

type OrderBy = (typeof headCells)[number]["id"];

function EnhancedTableHead({
  order,
  orderBy,
  onRequestSort,
}: {
  order: "asc" | "desc";
  orderBy: OrderBy;
  onRequestSort: (event: React.MouseEvent<unknown>, property: OrderBy) => void;
}) {
  const createSortHandler =
    (property: OrderBy) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            className="border-b border-b-[rgba(104,108,122,0.2)]"
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

export default function EnhancedTable({
  rewards,
  tokenID,
}: {
  rewards: (Gauge | VeDistReward)[];
  tokenID: string;
}) {
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");
  const [orderBy, setOrderBy] = React.useState<OrderBy>("balance");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
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

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: OrderBy
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  if (!rewards) {
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

  const onClaim = (reward: Gauge | VeDistReward) => {
    if (reward.rewardType === "Bribe") {
      stores.dispatcher.dispatch({
        type: ACTIONS.CLAIM_BRIBE,
        content: { pair: reward, tokenID },
      });
    } else if (reward.rewardType === "XXBribe") {
      stores.dispatcher.dispatch({
        type: ACTIONS.CLAIM_XX_BRIBE,
        content: { pair: reward, tokenID },
      });
    } else if (reward.rewardType === "XBribe") {
      stores.dispatcher.dispatch({
        type: ACTIONS.CLAIM_X_BRIBE,
        content: { pair: reward, tokenID },
      });
    } else if (reward.rewardType === "Reward") {
      stores.dispatcher.dispatch({
        type: ACTIONS.CLAIM_REWARD,
        content: { pair: reward, tokenID },
      });
    } else if (reward.rewardType === "Distribution") {
      stores.dispatcher.dispatch({
        type: ACTIONS.CLAIM_VE_DIST,
        content: { tokenID },
      });
    }
  };

  const emptyRows =
    rowsPerPage - Math.min(rowsPerPage, rewards.length - page * rowsPerPage);

  return (
    <div className="w-full">
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
              {stableSort(rewards, getComparator(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  if (!row) {
                    return null;
                  }

                  return (
                    <TableRow
                      key={"ssRewardsTable" + index}
                      className="hover:bg-[rgba(104,108,122,0.05)]"
                    >
                      <TableCell>
                        {isGaugeReward(row) &&
                          ["Bribe", "XBribe", "XXBribe", "Reward"].includes(
                            row.rewardType ?? ""
                          ) && (
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
                                    (e.target as HTMLImageElement).onerror =
                                      null;
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
                                    (e.target as HTMLImageElement).onerror =
                                      null;
                                    (e.target as HTMLImageElement).src =
                                      "/tokens/unknown-logo.png";
                                  }}
                                />
                              </div>
                              <div>
                                <Typography
                                  variant="h2"
                                  noWrap
                                  className="text-xs font-extralight"
                                >
                                  {row?.symbol}
                                </Typography>
                                <Typography
                                  variant="h5"
                                  className="text-xs font-extralight"
                                  color="textSecondary"
                                >
                                  {row?.rewardType !== "XBribe" &&
                                  row.rewardType !== "XXBribe"
                                    ? row?.rewardType
                                    : "Bribe"}
                                </Typography>
                              </div>
                            </div>
                          )}
                        {!isGaugeReward(row) &&
                          ["Distribution"].includes(row.rewardType ?? "") && (
                            <div className="flex items-center">
                              <div className="relative flex h-9 w-[70px]">
                                <img
                                  className="absolute top-0 left-0 rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                                  src={
                                    row &&
                                    row.lockToken &&
                                    row.lockToken.logoURI
                                      ? row.lockToken.logoURI
                                      : ``
                                  }
                                  width="37"
                                  height="37"
                                  alt=""
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).onerror =
                                      null;
                                    (e.target as HTMLImageElement).src =
                                      "/tokens/unknown-logo.png";
                                  }}
                                />
                              </div>
                              <div>
                                <Typography
                                  variant="h2"
                                  noWrap
                                  className="text-xs font-extralight"
                                >
                                  {row?.lockToken?.symbol}
                                </Typography>
                                <Typography
                                  variant="h5"
                                  className="text-xs font-extralight"
                                  color="textSecondary"
                                >
                                  {row?.rewardType}
                                </Typography>
                              </div>
                            </div>
                          )}
                      </TableCell>
                      <TableCell align="right">
                        <div>
                          {"gauge" in row && !row.gauge.balance && (
                            <div className="flex items-center justify-end">
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
                            row.rewardType === "Bribe" &&
                            row.gauge &&
                            row.gauge.balance &&
                            row.gauge.totalSupply && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h2"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve0 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token0.symbol}
                                  </Typography>
                                </div>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve1 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token1.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                          {row &&
                            row.rewardType === "XBribe" &&
                            row.gauge &&
                            row.gauge.balance &&
                            row.gauge.totalSupply && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h2"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve0 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token0.symbol}
                                  </Typography>
                                </div>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve1 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token1.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                          {row &&
                            row.rewardType === "XXBribe" &&
                            row.gauge &&
                            row.gauge.balance &&
                            row.gauge.totalSupply && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h2"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve0 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token0.symbol}
                                  </Typography>
                                </div>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve1 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token1.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                          {row &&
                            row.rewardType === "Reward" &&
                            row.gauge &&
                            row.gauge.balance &&
                            row.gauge.totalSupply && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h2"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve0 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token0.symbol}
                                  </Typography>
                                </div>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(
                                      BigNumber(row.gauge.balance)
                                        .div(row.gauge.totalSupply)
                                        .times(row.gauge.reserve1 ?? 0)
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.token1.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                          {row &&
                            !isGaugeReward(row) &&
                            row.rewardType === "Distribution" && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(row.token?.lockValue)}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row.lockToken.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <div>
                          {row &&
                            row.rewardType === "Bribe" &&
                            row.gauge &&
                            row.gauge.bribesEarned &&
                            row.gauge.bribesEarned.map((bribe) => {
                              return (
                                <div className="flex items-center justify-end">
                                  <img
                                    className="rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                                    src={
                                      bribe &&
                                      bribe.token &&
                                      bribe.token.logoURI
                                        ? bribe.token.logoURI
                                        : ``
                                    }
                                    width="24"
                                    height="24"
                                    alt=""
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).onerror =
                                        null;
                                      (e.target as HTMLImageElement).src =
                                        "/tokens/unknown-logo.png";
                                    }}
                                  />
                                  <Typography
                                    variant="h2"
                                    className="pl-3 text-xs font-extralight"
                                  >
                                    {formatCurrency(bribe.earned)}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className="pl-3 text-xs font-extralight"
                                    color="textSecondary"
                                  >
                                    {bribe.token?.symbol}
                                  </Typography>
                                </div>
                              );
                            })}
                          {row &&
                            row.rewardType === "XBribe" &&
                            row.gauge &&
                            row.gauge.x_bribesEarned &&
                            row.gauge.x_bribesEarned.map((bribe) => {
                              return (
                                <div className="flex items-center justify-end">
                                  <img
                                    className="rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                                    src={
                                      bribe &&
                                      bribe.token &&
                                      bribe.token.logoURI
                                        ? bribe.token.logoURI
                                        : ``
                                    }
                                    width="24"
                                    height="24"
                                    alt=""
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).onerror =
                                        null;
                                      (e.target as HTMLImageElement).src =
                                        "/tokens/unknown-logo.png";
                                    }}
                                  />
                                  <Typography
                                    variant="h2"
                                    className="pl-3 text-xs font-extralight"
                                  >
                                    {formatCurrency(bribe.earned)}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className="pl-3 text-xs font-extralight"
                                    color="textSecondary"
                                  >
                                    {bribe.token?.symbol}
                                  </Typography>
                                </div>
                              );
                            })}
                          {row &&
                            row.rewardType === "XXBribe" &&
                            row.gauge &&
                            row.gauge.xx_bribesEarned &&
                            row.gauge.xx_bribesEarned.map((bribe) => {
                              return (
                                <div
                                  className="flex items-center justify-end"
                                  key={bribe.token.address}
                                >
                                  <img
                                    className="rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
                                    src={
                                      bribe &&
                                      bribe.token &&
                                      bribe.token.logoURI
                                        ? bribe.token.logoURI
                                        : ``
                                    }
                                    width="24"
                                    height="24"
                                    alt=""
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).onerror =
                                        null;
                                      (e.target as HTMLImageElement).src =
                                        "/tokens/unknown-logo.png";
                                    }}
                                  />
                                  <Typography
                                    variant="h2"
                                    className="pl-3 text-xs font-extralight"
                                  >
                                    {formatCurrency(bribe.earned)}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className="pl-3 text-xs font-extralight"
                                    color="textSecondary"
                                  >
                                    {bribe.token?.symbol}
                                  </Typography>
                                </div>
                              );
                            })}
                          {row && row.rewardType === "Reward" && (
                            <>
                              <div className="flex items-center justify-end">
                                <Typography
                                  variant="h2"
                                  className="text-xs font-extralight"
                                >
                                  {formatCurrency(row.gauge.rewardsEarned)}
                                </Typography>
                                <Typography
                                  variant="h5"
                                  className={`min-w-[40px] text-xs font-extralight`}
                                  color="textSecondary"
                                >
                                  FLOW
                                </Typography>
                              </div>
                            </>
                          )}
                          {row &&
                            !isGaugeReward(row) &&
                            row.rewardType === "Distribution" && (
                              <>
                                <div className="flex items-center justify-end">
                                  <Typography
                                    variant="h5"
                                    className="text-xs font-extralight"
                                  >
                                    {formatCurrency(row.earned)}
                                  </Typography>
                                  <Typography
                                    variant="h5"
                                    className={`min-w-[40px] text-xs font-extralight`}
                                    color="textSecondary"
                                  >
                                    {row?.lockToken?.symbol}
                                  </Typography>
                                </div>
                              </>
                            )}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          color="primary"
                          onClick={() => {
                            onClaim(row);
                          }}
                        >
                          Claim
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={rewards.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </div>
  );
}

function descendingComparator(
  a: Gauge | VeDistReward,
  b: Gauge | VeDistReward,
  orderBy: OrderBy
) {
  if (!a || !b) {
    return 0;
  }

  let aAmount = 0;
  let bAmount = 0;

  switch (orderBy) {
    case "reward":
      if (a.rewardType && b.rewardType) {
        if (b.rewardType < a.rewardType) {
          return -1;
        }
        if (b.rewardType > a.rewardType) {
          return 1;
        }
      }
      if (isGaugeReward(a) && isGaugeReward(b)) {
        let caseA = a.symbol.toLowerCase();
        let caseB = b.symbol.toLowerCase();
        if (caseB < caseA) {
          return -1;
        }
        if (caseB > caseA) {
          return 1;
        }
      }
      return 0;

    case "balance":
      if (isGaugeReward(a) && a.rewardType === "Bribe" && a.gauge.balance) {
        aAmount = +a.gauge.balance;
      } else if (isGaugeReward(a) && a.balance) {
        aAmount = +a.balance;
      }

      if (isGaugeReward(b) && b.rewardType === "Bribe" && b.gauge.balance) {
        bAmount = +b.gauge.balance;
      } else if (isGaugeReward(b) && b.balance) {
        bAmount = +b.balance;
      }

      if (BigNumber(bAmount).lt(aAmount)) {
        return -1;
      }
      if (BigNumber(bAmount).gt(aAmount)) {
        return 1;
      }
      return 0;

    case "earned":
      if (a.rewardType === "Bribe") {
        aAmount = a.gauge?.bribes.length;
      } else {
        aAmount = 2;
      }

      if (b.rewardType === "Bribe") {
        bAmount = b.gauge?.bribes.length;
      } else {
        bAmount = 2;
      }

      if (BigNumber(bAmount).lt(aAmount)) {
        return -1;
      }
      if (BigNumber(bAmount).gt(aAmount)) {
        return 1;
      }
      return 0;

    default:
      return 0;
  }
}

function getComparator(order: "asc" | "desc", orderBy: OrderBy) {
  return order === "desc"
    ? (a: Gauge | VeDistReward, b: Gauge | VeDistReward) =>
        descendingComparator(a, b, orderBy)
    : (a: Gauge | VeDistReward, b: Gauge | VeDistReward) =>
        -descendingComparator(a, b, orderBy);
}

function stableSort(
  array: (Gauge | VeDistReward)[],
  comparator: (a: Gauge | VeDistReward, b: Gauge | VeDistReward) => number
) {
  const stabilizedThis = array.map((el, index) => [el, index] as const);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}
