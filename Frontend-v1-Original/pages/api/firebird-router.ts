import BigNumber from "bignumber.js";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  NATIVE_TOKEN,
  W_NATIVE_ADDRESS,
} from "../../stores/constants/constants";
import {
  Pair,
  QuoteSwapPayload,
  QuoteSwapResponse,
  hasGauge,
} from "../../stores/types/types";

const TANK = "0x0A868fd1523a1ef58Db1F2D135219F0e30CBf7FB" as `0x${string}`;
const VOLATILE_FEE = "50";
const STABLE_FEE = "25";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    payload: {
      content: { fromAsset, toAsset, fromAmount, slippage },
    },
    address,
  }: QuoteSwapPayload = JSON.parse(req.body);

  const sendFromAmount = BigNumber(fromAmount)
    .times(10 ** fromAsset.decimals)
    .toFixed();

  if (fromAsset.address === NATIVE_TOKEN.address) {
    fromAsset.address = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  }
  if (toAsset.address === NATIVE_TOKEN.address) {
    toAsset.address = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  }

  try {
    const pairs = await fetch(`${process.env.API}/api/v1/pairs`);
    const pairsJson = (await pairs.json()) as { data: Pair[] };

    const routes = await fetch(
      `https://router.firebird.finance/aggregator/v1/route?chainId=7700&from=${fromAsset.address}&to=${toAsset.address}&amount=${sendFromAmount}&slippage=${slippage}&receiver=${address}&source=velocimeter&dexes=velocimeterv1,velocimeterv2`,
      {
        method: "GET",
        headers: {
          "API-KEY": process.env.FIREBIRD_API_KEY!,
        },
      }
    );
    const routesJson = (await routes.json()) as QuoteSwapResponse;

    const { feeReceivers, feeAmounts } = getFeeReceiversAndAmounts(
      pairsJson.data,
      routesJson
    );
    console.log(feeReceivers, feeAmounts);

    const quote = await fetch(
      `https://dev-router.firebird.finance/aggregator/v1/route?chainId=7700&from=${fromAsset.address}&to=${toAsset.address}&amount=${sendFromAmount}&slippage=${slippage}&receiver=${address}&source=velocimeter&dexes=velocimeterv1,velocimeterv2&feeReceivers=${feeReceivers}&feeAmounts=${feeAmounts}&feeIn=false`,
      {
        method: "GET",
        headers: {
          "API-KEY": process.env.FIREBIRD_API_KEY_DEV!,
        },
      }
    );

    const resJson = (await quote.json()) as QuoteSwapResponse;
    res.status(200).json(resJson);
  } catch (e) {
    res.status(400);
  }
}

/**
 * Function returns an object of URL encoded strings of feeReceivers and feeAmounts
 * @param pairs Velocimeter pairs from API
 * @param quote Firebird API response with routes for swap
 * @returns Velocimeter fee receivers and amounts accordingly
 */
function getFeeReceiversAndAmounts(pairs: Pair[], quote: QuoteSwapResponse) {
  let feeReceiver = TANK;
  let pairAddress =
    "0x0000000000000000000000000000000000000000" as `0x${string}`;

  const poolsOfSwap = quote.maxReturn.paths.flatMap((path) =>
    path.swaps.map((swap) => swap.pool)
  );
  const tokenOut =
    quote.maxReturn.to === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      ? W_NATIVE_ADDRESS
      : quote.maxReturn.to;

  for (const poolOfSwap of poolsOfSwap) {
    const pair = pairs.find(
      (pair) => pair.address.toLowerCase() === poolOfSwap.toLowerCase()
    );
    if (
      pair &&
      hasGauge(pair) &&
      (pair.token0_address.toLowerCase() === tokenOut.toLowerCase() ||
        pair.token1_address.toLowerCase() === tokenOut.toLowerCase())
    ) {
      feeReceiver = pair.gauge.xx_wrapped_bribe_address;
      pairAddress = pair.address;
      break;
    }
  }

  // if no gauge found, use last pair to get fee amount
  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    pairAddress = quote.maxReturn.paths[0].swaps.at(-1)?.pool ?? pairAddress;
  }

  const feeAmounts = getFeeAmounts(pairs, pairAddress);

  // only one feeReceiver for the sake of simplicity
  const preparedFeeReceivers = [feeReceiver];
  const feeReceivers = preparedFeeReceivers
    .map((feeReceiver) => encodeURIComponent(feeReceiver))
    .join(",");

  return { feeReceivers, feeAmounts };
}

/**
 * Function returns a URL-encoded string of fee amounts based on the pairs and feeReceiver address
 * @param pairs Velocimeter pairs from API
 * @param pairAddress feeReceiver address (only one for now)
 * @returns URL-encoded string of fee amounts (only one fee amount for now)
 */
function getFeeAmounts(pairs: Pair[], pairAddress: `0x${string}`) {
  const stable = pairs.find(
    (pair) => pair.address.toLowerCase() === pairAddress.toLowerCase()
  )?.stable;
  const feeAmounts = stable ? [STABLE_FEE] : [VOLATILE_FEE];
  return feeAmounts.map((feeAmount) => encodeURIComponent(feeAmount)).join(",");
}
