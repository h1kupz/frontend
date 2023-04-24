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
import { Gauge, Vote, VestNFT } from "../../stores/types/types";

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
    id: "bchin",
    numeric: true,
    disablePadding: false,
    label: "---",
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
  onRequestSort: (event: undefined, property: OrderBy) => void;
}) {
  const { order, orderBy, onRequestSort } = props;

  const createSortHandler = (property: OrderBy) => () => {
    onRequestSort(undefined, property);
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
  gauges: Gauge[];
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
  const votesRef = useRef<Gauge[] | null>(null);

  const onSliderChange = (
    event: Event,
    value: number | number[],
    asset: Gauge
  ) => {
    if (
      orderBy === "mvp" ||
      orderBy === "myVotes" ||
      orderBy === "rewardEstimate"
    ) {
      setDisabledSort(true);
    }
    let newSliderValues = [...defaultVotes];

    newSliderValues = newSliderValues.map((val) => {
      if (asset?.address === val.address && !Array.isArray(value)) {
        val.value = value;
      }
      return val;
    });

    setParentSliderValues(newSliderValues);
  };

  const handleRequestSort = (event: undefined, property: OrderBy) => {
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

  const emptyRows =
    rowsPerPage - Math.min(rowsPerPage, gauges.length - page * rowsPerPage);

  const sortedGauges = useMemo(() => {
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
            {sortedGauges?.map((row) => (
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
  row: Gauge;
  token: VestNFT;
  defaultVotes: Array<Pick<Vote, "address"> & { value: number }>;
  onSliderChange: (event: Event, value: number | number[], row: Gauge) => void;
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

  let rewardEstimate: number;
  const votesCasting = (sliderValue / 100) * parseFloat(token?.lockValue);
  if (votesCasting > 0 && row.gauge.weight) {
    const divideBy = token?.actionedInCurrentEpoch
      ? parseFloat(row.gauge.weight)
      : votesCasting + parseFloat(row.gauge.weight);

    rewardEstimate =
      row.gauge.tbv > 0 && sliderValue > 0
        ? (row.gauge.tbv * votesCasting) / divideBy
        : 0;
  }
  const rewardPerThousand =
    row.gauge.weight && parseFloat(row.gauge.weight) > 0
      ? (row.gauge.tbv / parseFloat(row.gauge.weight)) * 1000
      : 0;
  return useMemo(() => {
    return (
      <TableRow key={row.gauge.address}>
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
                {row.symbol}
              </Typography>
              <Typography
                variant="h5"
                className="text-xs font-extralight"
                color="textSecondary"
              >
                {row.isStable ? "Stable Pool" : "Volatile Pool"}
              </Typography>
            </div>
          </div>
        </TableCell>
        <TableCell align="right">
          {!!row.gauge.weight && !!row.gauge.weightPercent ? (
            <>
              <Typography variant="h2" className="text-xs font-extralight">
                {formatCurrency(row.gauge.weight)}
              </Typography>
              <Typography
                variant="h5"
                className="text-xs font-extralight"
                color="textSecondary"
              >
                {formatCurrency(row.gauge.weightPercent)} %
              </Typography>
            </>
          ) : (
            <div className="flex items-center justify-end max-[1000px]:block">
              <Skeleton
                variant="rectangular"
                width={120}
                height={16}
                style={{ marginTop: "1px", marginBottom: "1px" }}
              />
            </div>
          )}
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            {formatCurrency(row.gauge.apr)} %
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="h2" className="text-xs font-extralight">
            ${formatCurrency(row.gauge.tbv)}
          </Typography>
        </TableCell>
        <TableCell align="right">
          {/* NOTE: instead of row.gauge.bribes from api show aggregated gaugebribes which accounts pair.gauge.bribes and pair.gauge.x_bribes */}
          {row.gaugebribes ? (
            row.gaugebribes.map((bribe, idx) => {
              return bribe.rewardAmount !== undefined ? (
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
              ) : (
                <div className="flex items-center justify-end max-[1000px]:block">
                  <Skeleton
                    variant="rectangular"
                    width={120}
                    height={16}
                    style={{ marginTop: "1px", marginBottom: "1px" }}
                    key={bribe.token.symbol}
                  />
                </div>
              );
            })
          ) : (
            <>
              <div className="flex items-center justify-end max-[1000px]:block">
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={16}
                  style={{ marginTop: "1px", marginBottom: "1px" }}
                />
              </div>
              <div className="flex items-center justify-end max-[1000px]:block">
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={16}
                  style={{ marginTop: "1px", marginBottom: "1px" }}
                />
              </div>
              <div className="flex items-center justify-end max-[1000px]:block">
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={16}
                  style={{ marginTop: "1px", marginBottom: "1px" }}
                />
              </div>
            </>
          )}
          {/* {row.gauge.bribes.map((bribe, idx) => {
            return bribe.rewardAmount !== undefined ? (
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
            ) : (
              <div className="flex items-center justify-end max-[1000px]:block">
                <Skeleton
                  variant="rectangular"
                  width={120}
                  height={16}
                  style={{ marginTop: "1px", marginBottom: "1px" }}
                  key={bribe.token.symbol}
                />
              </div>
            );
          })} */}
        </TableCell>
        <TableCell align="right">
          {row.gauge.bribeReserve ? (
            row.gauge.bribeReserve.map((bribe, idx) => {
              return (
                <div
                  className="flex items-center justify-end"
                  key={bribe + idx}
                >
                  <Typography variant="h2" className="text-xs font-extralight">
                    {formatCurrency(bribe)}
                  </Typography>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-end max-[1000px]:block">
              <Skeleton
                variant="rectangular"
                width={120}
                height={16}
                style={{ marginTop: "1px", marginBottom: "1px" }}
              />
            </div>
          )}
        </TableCell>
        <TableCell align="right">
          {!rewardEstimate ? (
            <>
              <Typography variant="h2" className="text-xs font-extralight">
                $
                {formatCurrency(
                  rewardPerThousand > row.gauge.tbv
                    ? row.gauge.tbv
                    : rewardPerThousand
                )}
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
              ${formatCurrency(rewardEstimate)}
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
  a: Gauge,
  b: Gauge,
  orderBy: OrderBy,
  defaultVotes?: Array<Pick<Vote, "address"> & { value: number }>,
  token?: VestNFT
) {
  if (!a || !b) {
    return 0;
  }

  switch (orderBy) {
    case "asset":
      let caseA = a.symbol.toLowerCase();
      let caseB = b.symbol.toLowerCase();
      if (caseB < caseA) {
        return -1;
      }
      if (caseB > caseA) {
        return 1;
      }
      return 0;

    case "votingAPR":
      if (BigNumber(b.gauge.apr).lt(a.gauge.apr)) {
        return -1;
      }
      if (BigNumber(b.gauge.apr).gt(a.gauge.apr)) {
        return 1;
      }
      return 0;

    case "rewardEstimate":
      const sliderValueA = defaultVotes?.find(
        (el) => el.address === a?.address
      )?.value;
      const sliderValueB = defaultVotes?.find(
        (el) => el.address === b?.address
      )?.value;
      let rewardEstimateA: number | undefined;
      let rewardEstimateB: number | undefined;

      const votesCastingA =
        (sliderValueA ?? 0 / 100) * parseFloat(token?.lockValue ?? "0");
      if (votesCastingA > 0 && a.gauge.weight && sliderValueA) {
        const divideByA = token?.actionedInCurrentEpoch
          ? parseFloat(a.gauge.weight)
          : votesCastingA + parseFloat(a.gauge.weight);
        rewardEstimateA =
          a.gauge.tbv > 0 && sliderValueA > 0
            ? (a.gauge.tbv * votesCastingA) / divideByA
            : 0;
      }

      const votesCastingB =
        (sliderValueB ?? 0 / 100) * parseFloat(token?.lockValue ?? "0");
      if (votesCastingB > 0 && b.gauge.weight && sliderValueB) {
        const divideByB = token?.actionedInCurrentEpoch
          ? parseFloat(b.gauge.weight)
          : votesCastingB + parseFloat(b.gauge.weight);
        rewardEstimateB =
          b.gauge.tbv > 0 && sliderValueB > 0
            ? (b.gauge.tbv * votesCastingB) / divideByB
            : 0;
      }

      const _rewardPerThousandA =
        a.gauge.weight && parseFloat(a.gauge.weight) > 0
          ? (a.gauge.tbv / parseFloat(a.gauge.weight)) * 1000
          : 0;
      const _rewardPerThousandB =
        b.gauge.weight && parseFloat(b.gauge.weight) > 0
          ? (b.gauge.tbv / parseFloat(b.gauge.weight)) * 1000
          : 0;
      const rewardPerThousandA =
        _rewardPerThousandA > a.gauge.tbv ? a.gauge.tbv : _rewardPerThousandA;
      const rewardPerThousandB =
        _rewardPerThousandB > b.gauge.tbv ? b.gauge.tbv : _rewardPerThousandB;

      if (rewardEstimateB && rewardEstimateA) {
        if (rewardEstimateB < rewardEstimateA) {
          return -1;
        }
        if (rewardEstimateB > rewardEstimateA) {
          return 1;
        }
      } else if (rewardEstimateB && !rewardEstimateA) {
        return 1;
      } else if (rewardEstimateA && !rewardEstimateB) {
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
      if (!a.gauge.weight || !b.gauge.weight) {
        return 0;
      }
      if (BigNumber(b.gauge.weight).lt(a.gauge.weight)) {
        return -1;
      }
      if (BigNumber(b.gauge.weight).gt(a.gauge.weight)) {
        return 1;
      }
      return 0;

    case "totalBribesUSD":
    case "apy":
      if (BigNumber(b.gauge.tbv).lt(a.gauge.tbv)) {
        return -1;
      }
      if (BigNumber(b.gauge.tbv).gt(a.gauge.tbv)) {
        return 1;
      }
      return 0;

    case "myVotes":
    case "mvp":
      const sliderValue1 = defaultVotes?.find(
        (el) => el.address === a?.address
      )?.value;
      const sliderValue2 = defaultVotes?.find(
        (el) => el.address === b?.address
      )?.value;
      if (
        sliderValue1 !== undefined &&
        sliderValue2 !== undefined &&
        sliderValue2 < sliderValue1
      ) {
        return -1;
      }
      if (
        sliderValue1 !== undefined &&
        sliderValue2 !== undefined &&
        sliderValue2 > sliderValue1
      ) {
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
    ? (a: Gauge, b: Gauge) =>
        descendingComparator(a, b, orderBy, defaultVotes, token)
    : (a: Gauge, b: Gauge) =>
        -descendingComparator(a, b, orderBy, defaultVotes, token);
}

function stableSort(
  array: Gauge[],
  comparator: (a: Gauge, b: Gauge) => number
) {
  const stabilizedThis = array.map((el, index) => [el, index] as const);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}
