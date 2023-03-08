import type { NextApiRequest, NextApiResponse } from "next";
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from "ethereum-multicall";
import Web3 from "web3";

import { CONTRACTS } from "../../stores/constants/constants";
import { RouteAsset } from "../../stores/types/types";

const web3 = new Web3(
  process.env.VELOCIMETER_NODE ?? "https://canto.slingshot.finance/"
);
const multicall = new Multicall({
  web3Instance: web3,
  tryAggregate: true,
  multicallCustomContractAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
});

interface AmountOut {
  routes: {
    from: string;
    to: string;
    stable: boolean;
  }[];
  routeAsset: null | RouteAsset;
}

type AmountsOut = AmountOut[];

// TODO why is that...
interface WeirdBigNumber {
  hex: string;
  type: "BigNumber";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    sendFromAmount,
    routes,
  }: {
    sendFromAmount: string;
    routes: AmountsOut;
  } = JSON.parse(req.body);

  const calls = routes.map((route) => {
    return {
      reference: route.routes[0].from + route.routes[0].to,
      methodName: "getAmountsOut",
      methodParameters: [sendFromAmount, route.routes],
    };
  });

  const contractCallContext: ContractCallContext[] = [
    {
      reference: "routerContract",
      contractAddress: CONTRACTS.ROUTER_ADDRESS,
      abi: CONTRACTS.ROUTER_ABI,
      calls,
    },
  ];

  const results: ContractCallResults = await multicall.call(
    contractCallContext
  );

  const returnValuesBigNumbers =
    results.results.routerContract.callsReturnContext.map((retCtx) => {
      if (retCtx.success) {
        return retCtx.returnValues as [WeirdBigNumber, WeirdBigNumber];
      }
    });

  let returnValues = [];

  for (const returnValue of returnValuesBigNumbers) {
    if (!returnValue) {
      returnValues.push([sendFromAmount, "0", "0"]);
      continue;
    }
    const arr = returnValue.map((bignumber) => {
      return web3.utils.hexToNumberString(bignumber.hex);
    });
    returnValues.push(arr);
  }

  res.status(200).json(returnValues);
}
