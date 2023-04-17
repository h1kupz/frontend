import { Typography } from "@mui/material";

import VestsTable from "./ssVestsTable";
import PartnersVests from "./partnersVests";

import { useVestNfts, useGovToken, useVeToken } from "./queries";

export default function ssVests() {
  const { data: govToken } = useGovToken();
  const { data: veToken } = useVeToken();
  const { data: vestNFTs } = useVestNfts();

  return (
    <div className="m-auto mb-5 flex w-[calc(100%-40px)] max-w-[1400px] flex-col items-end p-0 pt-20 pb-2 xl:mb-14 xl:w-[calc(100%-180px)] xl:pt-0">
      <div className="flex flex-col gap-1 self-start text-left">
        <Typography variant="h1">Vest</Typography>
        <Typography variant="body2">
          Lock FLOW into veFLOW to earn and govern. Vote with veFLOW to earn
          bribes and trading fees. veFLOW can be transferred, merged and split.
          You can hold multiple positions.
        </Typography>
      </div>
      <VestsTable vestNFTs={vestNFTs} govToken={govToken} veToken={veToken} />
      <PartnersVests />
    </div>
  );
}
