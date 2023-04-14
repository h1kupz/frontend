import React, { useState } from "react";
import Skeleton from "@mui/lab/Skeleton";
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
  Toolbar,
  Grid,
  Tooltip,
  Dialog,
} from "@mui/material";
import { useRouter } from "next/router";
import { EnhancedEncryptionOutlined, Check, Close } from "@mui/icons-material";
import moment from "moment";
import BigNumber from "bignumber.js";

import {
  useAverageNftDelegationAPR,
  useAverageStrategiesDelegationAPR,
} from "./queries";

import stores from "../../stores";
import useVoteManagerStore from "../../stores/voteManagerStore";
import { formatCurrency } from "../../utils/utils";
import { ACTIONS } from "../../stores/constants/constants";
import { GovToken, VestNFT, VeToken } from "../../stores/types/types";

const headCells = [
  { id: "NFT", numeric: false, disablePadding: false, label: "NFT" },
  { id: "Voted", numeric: false, disablePadding: false, label: "Voted" },
  {
    id: "Locked Amount",
    numeric: true,
    disablePadding: false,
    label: "Vest Amount",
  },
  {
    id: "Lock Value",
    numeric: true,
    disablePadding: false,
    label: "Vest Value",
  },
  {
    id: "Lock Expires",
    numeric: true,
    disablePadding: false,
    label: "Vest Expires",
  },
  {
    id: "",
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

const EnhancedTableToolbar = () => {
  const router = useRouter();

  const onCreate = () => {
    router.push("/vest/create");
  };

  return (
    <Toolbar className="my-6 mx-0 p-0">
      <Grid container spacing={1}>
        <Grid lg="auto" md={12} sm={12} xs={12} item>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<EnhancedEncryptionOutlined />}
            size="large"
            className="w-full bg-[#272826] font-bold text-cantoGreen hover:bg-[rgb(19,44,60)]"
            onClick={onCreate}
          >
            <Typography className="text-base font-bold">Create Lock</Typography>
          </Button>
        </Grid>
        <Grid item lg={true} md={true} sm={false} xs={false}></Grid>
      </Grid>
    </Toolbar>
  );
};

export default function EnhancedTable({
  vestNFTs,
  govToken,
  veToken,
}: {
  vestNFTs: VestNFT[];
  govToken: GovToken | null;
  veToken: VeToken | null;
}) {
  const router = useRouter();

  const [order, setOrder] = React.useState<"asc" | "desc">("desc");
  const [orderBy, setOrderBy] = React.useState<OrderBy>("Lock Value");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [voteManagerOpen, setVoteManagerOpen] = useState(false);
  const [selectedNft, setSelectedNft] = useState<VestNFT>();

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRequestSort = (
    event: React.MouseEvent<unknown, MouseEvent>,
    property: OrderBy
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  if (!vestNFTs) {
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

  const onView = (nft: VestNFT) => {
    router.push(`/vest/${nft.id}`);
  };

  const onReset = (nft: VestNFT) => {
    stores.dispatcher.dispatch({
      type: ACTIONS.RESET_VEST,
      content: { tokenID: nft.id },
    });
  };

  const onVoteManagerDialogClose = () => {
    setVoteManagerOpen(false);
    setSelectedNft(undefined);
  };

  const { autolock } = useVoteManagerStore();

  const emptyRows =
    rowsPerPage - Math.min(rowsPerPage, vestNFTs.length - page * rowsPerPage);

  return (
    <>
      <div className="w-full">
        <EnhancedTableToolbar />
        <Paper
          elevation={0}
          className="flex w-full flex-col items-end border border-[rgba(104,108,122,0.25)]"
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
                {stableSort(vestNFTs, getComparator(order, orderBy))
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, index) => {
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
                                className="absolute left-0 top-0 rounded-[30px]"
                                src={govToken?.logoURI || undefined}
                                width="35"
                                height="35"
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
                              >
                                {row.id}
                              </Typography>
                              <Typography
                                variant="h5"
                                className="text-xs font-extralight"
                                color="textSecondary"
                              >
                                NFT ID
                              </Typography>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {!!row.voted ? (
                              <Check className="fill-green-500" />
                            ) : (
                              <Close className="fill-red-500" />
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {formatCurrency(row.lockAmount)}
                          </Typography>
                          <Typography
                            variant="h5"
                            className="text-xs font-extralight"
                            color="textSecondary"
                          >
                            {govToken?.symbol}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {formatCurrency(row.lockValue)}
                          </Typography>
                          <Typography
                            variant="h5"
                            className="text-xs font-extralight"
                            color="textSecondary"
                          >
                            {veToken?.symbol}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="h2"
                            className="text-xs font-extralight"
                          >
                            {moment.unix(+row.lockEnds).format("YYYY-MM-DD")}
                          </Typography>
                          <Typography
                            variant="h5"
                            className="text-xs font-extralight"
                            color="textSecondary"
                          >
                            Expires {moment.unix(+row.lockEnds).fromNow()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip
                            title={
                              <div>
                                Only reset it if you want to do NFT merge.
                                <br />
                                Reset disables voting until next epoch.
                              </div>
                            }
                            placement="right"
                            enterTouchDelay={500}
                          >
                            <span>
                              <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                  onReset(row);
                                }}
                                className="mr-2"
                                disabled={row.delegated}
                                sx={{
                                  "&.MuiButton-root.Mui-disabled": {
                                    color: "gray",
                                    borderColor: "gray",
                                  },
                                }}
                              >
                                Reset
                              </Button>
                            </span>
                          </Tooltip>
                          {row.delegated && row.autolock ? (
                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                autolock(row.id, false);
                              }}
                              className="mr-2"
                            >
                              Disable autolock
                            </Button>
                          ) : row.delegated && !row.autolock ? (
                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                autolock(row.id, true);
                              }}
                              className="mr-2"
                            >
                              Enable autolock
                            </Button>
                          ) : null}
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => {
                              setSelectedNft(row);
                              setVoteManagerOpen(true);
                            }}
                            className="mr-2"
                          >
                            {row.delegated ? "Undelegate" : "Delegate"}
                          </Button>
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => {
                              onView(row);
                            }}
                            sx={{
                              "&.MuiButton-root.Mui-disabled": {
                                color: "gray",
                                borderColor: "gray",
                              },
                            }}
                          >
                            Manage
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
            count={vestNFTs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </div>
      <VoteManagerDialog
        open={voteManagerOpen}
        onClose={onVoteManagerDialogClose}
        nft={selectedNft}
      />
    </>
  );
}

function VoteManagerDialog({
  open,
  onClose,
  nft,
}: {
  open: boolean;
  onClose: () => void;
  nft?: VestNFT;
}) {
  const [enableAutolock, setEnableAutolock] = useState(true);
  const { delegate, undelegate } = useVoteManagerStore();

  const { isFetching: isFetchingAPR, data: apr } =
    useAverageStrategiesDelegationAPR(nft);

  const { isFetching: isFetchingAPROfNft, data: aprOfNft } =
    useAverageNftDelegationAPR(nft);

  if (!nft) {
    return null;
  }

  const internalOnClose = () => {
    setEnableAutolock(true);
    onClose();
  };

  return (
    <Dialog
      aria-labelledby="vote-manager-modal"
      open={open}
      onClose={internalOnClose}
      sx={{ "& .MuiDialog-paper": { all: "unset" } }}
    >
      <div className="w-96 max-w-md rounded-md bg-[#040105] p-5 shadow-glow">
        {nft.delegated ? (
          <>
            <div className="text-lg font-semibold">Undelegate NFT#{nft.id}</div>
            <div
              className={`font-sono text-lg ${
                isFetchingAPROfNft ? "animate-pulse" : ""
              }`}
            >
              NFT APR is {aprOfNft} %
            </div>
            <div className="flex items-end justify-end">
              <button
                onClick={() => undelegate(nft.id)}
                className="border border-cantoGreen px-2 py-2 text-center text-sm font-medium text-cantoGreen transition-all duration-300 hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-green-200"
              >
                Undelegate
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold">Delegate NFT#{nft.id}</div>
            <div
              className={`font-sono text-lg ${
                isFetchingAPR ? "animate-pulse" : ""
              }`}
            >
              Average APR is {apr} %
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-sm text-slate-300">
                <div>To Delegate:</div>
                <ul>
                  <li>-NFT must have minimun of 500 FLOW vested</li>
                  <li>-NFT must be locked for at least 7 more days</li>
                </ul>
              </div>
              <div className="flex items-end justify-between">
                <Tooltip
                  title="Autolock extends your veFLOW lock duration by 1 week every week to maintain
                your voting power"
                  placement="left"
                >
                  <div
                    className="flex max-w-fit cursor-pointer items-center gap-1 text-sm"
                    onClick={() => setEnableAutolock((prev) => !prev)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setEnableAutolock((prev) => !prev);
                      }
                    }}
                  >
                    <div
                      className={`h-4 w-4 outline outline-1 outline-cantoGreen transition-colors ${
                        enableAutolock
                          ? "bg-cantoGreen outline-offset-1"
                          : "bg-transparent"
                      }`}
                    />
                    <div>
                      autolock {enableAutolock ? "enabled" : "disabled"}
                    </div>
                  </div>
                </Tooltip>
                <button
                  onClick={() => delegate(nft.id, enableAutolock)}
                  className="border border-cantoGreen px-2 py-2 text-center text-sm font-medium text-cantoGreen transition-colors hover:bg-green-900 focus:outline-none focus:ring-4 focus:ring-green-200"
                >
                  Delegate
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function descendingComparator(a: VestNFT, b: VestNFT, orderBy: OrderBy) {
  if (!a || !b) {
    return 0;
  }

  switch (orderBy) {
    case "NFT":
      return 0;
    case "Voted":
      if (b.voted && !a.voted) {
        return -1;
      }
      if (!b.voted && a.voted) {
        return 1;
      }
      return 0;
    case "Lock Expires":
      return BigNumber(b.lockEnds).minus(a.lockEnds).toNumber();
    case "Locked Amount":
      return BigNumber(b.lockAmount).minus(a.lockAmount).toNumber();
    case "Lock Value":
      return BigNumber(b.lockValue).minus(a.lockValue).toNumber();
  }

  return 0;
}

function getComparator(order: "asc" | "desc", orderBy: OrderBy) {
  return order === "desc"
    ? (a: VestNFT, b: VestNFT) => descendingComparator(a, b, orderBy)
    : (a: VestNFT, b: VestNFT) => -descendingComparator(a, b, orderBy);
}

function stableSort(
  array: VestNFT[],
  comparator: (a: VestNFT, b: VestNFT) => number
) {
  const stabilizedThis = array.map((el, index) => [el, index] as const);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}
