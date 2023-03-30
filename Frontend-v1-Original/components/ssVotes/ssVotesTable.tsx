import { useState, useMemo, useRef } from "react";
import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Typography,
  Slider,
} from "@mui/material";
import BigNumber from "bignumber.js";

import { formatCurrency } from "../../utils/utils";
import { Pair, Vote, VestNFT } from "../../stores/types/types";

const headCells = [
  { id: "asset", numeric: false, disablePadding: false, label: "Asset" },
  {
    id: "totalVotes",
    numeric: true,
    disablePadding: false,
    label: "Total Votes",
  },
  {
    id: "votingAPR",
    numeric: true,
    disablePadding: false,
    label: "Voting APR",
  },
  {
    id: "totalBribesUSD",
    numeric: true,
    disablePadding: false,
    label: "Total Bribe Value",
  },
  {
    id: "apy",
    numeric: true,
    disablePadding: false,
    label: "Bribes",
  },
  {
    id: "rewardEstimate",
    numeric: true,
    disablePadding: false,
    label: "Reward Estimate",
  },
  {
    id: "myVotes",
    numeric: true,
    disablePadding: false,
    label: "My Votes",
  },
  {
    id: "mvp",
    numeric: true,
    disablePadding: false,
    label: "My Vote %",
  },
] as const;

type OrderBy = (typeof headCells)[number]["id"];

function EnhancedTableHead(props: {
  order: "asc" | "desc";
  orderBy: OrderBy;
  onRequestSort: (event: any, property: OrderBy) => void;
}) {
  const { order, orderBy, onRequestSort } = props;

  const createSortHandler = (property: OrderBy) => (event) => {
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
  gauges,
  setParentSliderValues,
  defaultVotes,
  token,
}: {
  gauges: Pair[];
  setParentSliderValues: React.Dispatch<
    React.SetStateAction<
      (Pick<Vote, "address"> & {
        value: number;
      })[]
    >
  >;
  defaultVotes: Array<Pick<Vote, "address"> & { value: number }>;
  token: VestNFT;
}) {
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [orderBy, setOrderBy] = useState<OrderBy>("votingAPR");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [disabledSort, setDisabledSort] = useState(false);
  const votesRef = useRef(null);

  const onSliderChange = (event, value, asset) => {
    if (
      orderBy === "mvp" ||
      orderBy === "myVotes" ||
      orderBy === "rewardEstimate"
    ) {
      setDisabledSort(true);
    }
    let newSliderValues = [...defaultVotes];

    newSliderValues = newSliderValues.map((val) => {
      if (asset?.address === val.address) {
        val.value = value;
      }
      return val;
    });

    setParentSliderValues(newSliderValues);
  };

  const handleRequestSort = (event, property: OrderBy) => {
    if (
      disabledSort &&
      (property === "mvp" ||
        property === "myVotes" ||
        property === "rewardEstimate")
    ) {
      return;
    } else if (disabledSort) {
      setDisabledSort(false);
    }
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const emptyRows =
    rowsPerPage - Math.min(rowsPerPage, gauges.length - page * rowsPerPage);

  const sortedGauges = useMemo<Pair[]>(() => {
    if (disabledSort) {
      return votesRef.current;
    }
    votesRef.current = stableSort(
      gauges,
      getComparator(order, orderBy, defaultVotes, token)
    ).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    return votesRef.current;
  }, [gauges, order, orderBy, page, rowsPerPage, defaultVotes, disabledSort]);

  if (!gauges || gauges.length === 0) {
    return (
      <div className="w-full">
        <TableContainer className="px-6 lg:overflow-x-hidden">
          <Table
            aria-labelledby="tableTitle"
            size={"medium"}
            aria-label="enhanced table"
          >
            <TableBody>
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
              <Skeleton variant="rounded" height={40} className="my-3 w-full" />
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={gauges.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <TableContainer className="lg:overflow-x-hidden">
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
            {sortedGauges.map((row) => (
              <VotesRow
                row={row}
                token={token}
                defaultVotes={defaultVotes}
                onSliderChange={onSliderChange}
                key={row.address}
              />
            ))}
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
        count={gauges.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </div>
  );
}

function VotesRow({
  row,
  token,
  defaultVotes,
  onSliderChange,
}: {
  row: Pair;
  token: VestNFT;
  defaultVotes: Array<Pick<Vote, "address"> & { value: number }>;
  onSliderChange: (event: any, value: any, asset: any) => void;
}) {
  if (!row) {
    return null;
  }

  let sliderValue = defaultVotes.find(
    (el) => el.address === row?.address
  )?.value;
  if (!sliderValue) {
    sliderValue = 0;
  }

  let rewardEstimateDisplay: number;
  const votesCasting = (sliderValue / 100) * parseFloat(token?.lockValue);
  if (votesCasting > 0) {
    const divideBy = token?.voted
      ? parseFloat(row?.gauge?.weight)
      : votesCasting + parseFloat(row?.gauge?.weight);

    const rewardEstimate =
      row.gauge?.bribesInUsd > 0 && sliderValue > 0
        ? (row.gauge?.bribesInUsd * votesCasting) / divideBy
        : 0;
    rewardEstimateDisplay =
      rewardEstimate > row.gauge.bribesInUsd
        ? row.gauge.bribesInUsd
        : rewardEstimate;
  }
  const rewardPerThousand =
    parseFloat(row?.gauge?.weight) > 0
      ? (row.gauge.bribesInUsd / parseFloat(row?.gauge?.weight)) * 1000
      : 0;
  const rewardPerThousandDisplay =
    rewardPerThousand > row.gauge.bribesInUsd
      ? row.gauge.bribesInUsd
      : rewardPerThousand;
  return useMemo(() => {
    return (
      <TableRow key={row?.gauge?.address}>
        <TableCell>
          <div className="flex items-center">
            <div className="relative flex h-[35px] w-[70px]">
              <img
                className="absolute left-0 top-0 rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
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
                className="absolute left-6 top-0 z-[1] rounded-[30px] border-[3px] border-[rgb(25,33,56)]"
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
              <Typography variant="h2" className="text-xs font-extralight">
                {row?.symbol}
              </Typography>
              <Typography
                variant="h5"
                className="text-xs font-extralight"
                color="textSecondary"
              >
                {row?.isStable ? "Stable Pool" : "Volatile Pool"}
              </Typography>
            </div>
          </div>
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            {formatCurrency(row?.gauge?.weight)}
          </Typography>
          <Typography
            variant="h5"
            className="text-xs font-extralight"
            color="textSecondary"
          >
            {formatCurrency(row?.gauge?.weightPercent)} %
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            {formatCurrency(row?.gauge?.votingApr)} %
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            ${formatCurrency(row?.gauge?.bribesInUsd)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          {row?.gauge?.bribes.map((bribe, idx) => {
            return (
              <div
                className="flex items-center justify-end"
                key={bribe.token.symbol}
              >
                <Typography variant="h2" className="text-xs font-extralight">
                  {formatCurrency(bribe.rewardAmount)}
                </Typography>
                <Typography
                  variant="h5"
                  className="text-xs font-extralight"
                  color="textSecondary"
                >
                  {bribe.token.symbol}
                </Typography>
              </div>
            );
          })}
        </TableCell>
        <TableCell align="right">
          {!rewardEstimateDisplay ? (
            <>
              <Typography variant="h2" className="text-xs font-extralight">
                ${formatCurrency(rewardPerThousandDisplay)}
              </Typography>
              <Typography
                variant="h5"
                className="text-xs font-extralight"
                color="textSecondary"
              >
                per 1000 votes
              </Typography>
            </>
          ) : (
            <Typography variant="h2" className="text-xs font-extralight">
              ${formatCurrency(rewardEstimateDisplay)}
            </Typography>
          )}
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            {formatCurrency(votesCasting)}
          </Typography>
          <Typography
            variant="h5"
            className="text-xs font-extralight"
            color="textSecondary"
          >
            {formatCurrency(sliderValue)} %
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Slider
            valueLabelDisplay="auto"
            value={sliderValue}
            onChange={(event, value) => {
              onSliderChange(event, value, row);
            }}
            min={0}
            max={100}
          />
        </TableCell>
      </TableRow>
    );
  }, [token, defaultVotes, row]);
}

function descendingComparator(
  a: Pair,
  b: Pair,
  orderBy: OrderBy,
  defaultVotes?: Array<Pick<Vote, "address"> & { value: number }>,
  token?: VestNFT
) {
  if (!a || !b) {
    return 0;
  }

  switch (orderBy) {
    case "votingAPR":
      if (BigNumber(b?.gauge?.votingApr).lt(a?.gauge?.votingApr)) {
        return -1;
      }
      if (BigNumber(b?.gauge?.votingApr).gt(a?.gauge?.votingApr)) {
        return 1;
      }
      return 0;

    case "rewardEstimate":
      const sliderValueA = defaultVotes.find(
        (el) => el.address === a?.address
      )?.value;
      const sliderValueB = defaultVotes.find(
        (el) => el.address === b?.address
      )?.value;
      let rewardEstimateDisplayA: number;
      let rewardEstimateDisplayB: number;

      const votesCastingA =
        (sliderValueA / 100) * parseFloat(token?.lockValue ?? "0");
      if (votesCastingA > 0) {
        const divideByA = token?.voted
          ? parseFloat(a?.gauge?.weight)
          : votesCastingA + parseFloat(a?.gauge?.weight);
        const rewardEstimateA =
          a.gauge?.bribesInUsd > 0 && sliderValueA > 0
            ? (a.gauge?.bribesInUsd * votesCastingA) / divideByA
            : 0;
        rewardEstimateDisplayA =
          rewardEstimateA > a.gauge.bribesInUsd
            ? a.gauge.bribesInUsd
            : rewardEstimateA;
      }

      const votesCastingB =
        (sliderValueB / 100) * parseFloat(token?.lockValue ?? "0");
      if (votesCastingB > 0) {
        const divideByB = token?.voted
          ? parseFloat(b?.gauge?.weight)
          : votesCastingB + parseFloat(b?.gauge?.weight);
        const rewardEstimateB =
          b.gauge?.bribesInUsd > 0 && sliderValueB > 0
            ? (b.gauge?.bribesInUsd * votesCastingB) / divideByB
            : 0;
        rewardEstimateDisplayB =
          rewardEstimateB > b.gauge.bribesInUsd
            ? b.gauge.bribesInUsd
            : rewardEstimateB;
      }

      const _rewardPerThousandA =
        parseFloat(a?.gauge?.weight) > 0
          ? (a.gauge.bribesInUsd / parseFloat(a?.gauge?.weight)) * 1000
          : 0;
      const _rewardPerThousandB =
        parseFloat(b?.gauge?.weight) > 0
          ? (b.gauge.bribesInUsd / parseFloat(b?.gauge?.weight)) * 1000
          : 0;
      const rewardPerThousandA =
        _rewardPerThousandA > a.gauge.bribesInUsd
          ? a.gauge.bribesInUsd
          : _rewardPerThousandA;
      const rewardPerThousandB =
        _rewardPerThousandB > b.gauge.bribesInUsd
          ? b.gauge.bribesInUsd
          : _rewardPerThousandB;

      if (rewardEstimateDisplayB && rewardEstimateDisplayA) {
        if (rewardEstimateDisplayB < rewardEstimateDisplayA) {
          return -1;
        }
        if (rewardEstimateDisplayB > rewardEstimateDisplayA) {
          return 1;
        }
      } else if (rewardEstimateDisplayB && !rewardEstimateDisplayA) {
        return 1;
      } else if (rewardEstimateDisplayA && !rewardEstimateDisplayB) {
        return -1;
      }
      if (rewardPerThousandB < rewardPerThousandA) {
        return -1;
      }
      if (rewardPerThousandB > rewardPerThousandA) {
        return 1;
      }
      return 0;

    case "totalVotes":
      if (BigNumber(b?.gauge?.weightPercent).lt(a?.gauge?.weightPercent)) {
        return -1;
      }
      if (BigNumber(b?.gauge?.weightPercent).gt(a?.gauge?.weightPercent)) {
        return 1;
      }
      return 0;

    case "totalBribesUSD":
    case "apy":
      if (BigNumber(b?.gauge?.bribesInUsd).lt(a?.gauge?.bribesInUsd)) {
        return -1;
      }
      if (BigNumber(b?.gauge?.bribesInUsd).gt(a?.gauge?.bribesInUsd)) {
        return 1;
      }
      return 0;

    case "myVotes":
    case "mvp":
      const sliderValue1 = defaultVotes.find(
        (el) => el.address === a?.address
      )?.value;
      const sliderValue2 = defaultVotes.find(
        (el) => el.address === b?.address
      )?.value;
      if (sliderValue2 < sliderValue1) {
        return -1;
      }
      if (sliderValue2 > sliderValue1) {
        return 1;
      }
      return 0;

    default:
      return 0;
  }
}

function getComparator(
  order: "asc" | "desc",
  orderBy: OrderBy,
  defaultVotes?: Array<Pick<Vote, "address"> & { value: number }>,
  token?: VestNFT
) {
  return order === "desc"
    ? (a: Pair, b: Pair) =>
        descendingComparator(a, b, orderBy, defaultVotes, token)
    : (a: Pair, b: Pair) =>
        -descendingComparator(a, b, orderBy, defaultVotes, token);
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
