import { useRouter } from "next/router";
import {
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import Link from "next/link";
import { useEffect, useState } from "react";

import stores from "../../stores";
import { VeToken, VestNFT } from "../../stores/types/types";
import { formatCurrency } from "../../utils/utils";
import { ACTIONS } from "../../stores/constants/constants";

import classes from "./ssVest.module.css";

export function MergeNFT() {
  const router = useRouter();
  const { id } = router.query;
  const [nfts, setNfts] = useState<VestNFT[]>(
    stores.stableSwapStore.getStore("vestNFTs")
  );
  const [veToken, setVeToken] = useState<VeToken | null>(
    stores.stableSwapStore.getStore("veToken")
  );
  const [selectedNFTId, setSelectedNFTId] = useState<string | null>(null);

  const onMergeNFT = (from: string, to: string | null) => {
    if (to === null) return;
    stores.dispatcher.dispatch({
      type: ACTIONS.MERGE_NFT,
      content: {
        from,
        to,
      },
    });
  };

  useEffect(() => {
    // wait for veToken
    if (veToken) {
      if (nfts.length === 0) {
        // only refetch when nfts is empty, i.e., when users refresh the page
        stores.dispatcher.dispatch({
          type: ACTIONS.GET_VEST_NFTS,
          content: {},
        });
      }
    }
  }, [veToken, nfts]);

  useEffect(() => {
    const ssConfigureCalled = () => {
      setVeToken(stores.stableSwapStore.getStore("veToken"));
    };
    const nftsReturned = (nfts: VestNFT[]) => {
      setNfts(nfts);
    };
    const nftMerged = () => {
      router.push("/vest");
    };
    // wait for veToken
    stores.emitter.on(ACTIONS.UPDATED, ssConfigureCalled);
    // wait for nfts
    stores.emitter.on(ACTIONS.VEST_NFTS_RETURNED, nftsReturned);
    // wait for nft merged
    stores.emitter.on(ACTIONS.MERGE_NFT_RETURNED, nftMerged);
    return () => {
      stores.emitter.removeListener(ACTIONS.UPDATED, ssConfigureCalled);
      stores.emitter.removeListener(ACTIONS.VEST_NFTS_RETURNED, nftsReturned);
      stores.emitter.removeListener(ACTIONS.MERGE_NFT_RETURNED, nftMerged);
    };
  }, [router]);

  return (
    <div className={classes.vestContainer}>
      <Paper elevation={0} className={classes.container2}>
        <div className="relative flex flex-row items-center justify-center rounded-lg border border-[#212B48] py-5">
          <Link href={`/vest`} title="back to vest">
            <IconButton className="absolute left-[5px]">
              <ArrowBack className={classes.backIcon} />
            </IconButton>
          </Link>
          <Typography className={classes.titleText}>Merge NFT {id}</Typography>
        </div>
        <div className="space-y-2">
          <Typography>Select the NFT to merge #{id} into:</Typography>
          <FormControl fullWidth>
            <Select
              value={selectedNFTId}
              onChange={(e) => {
                setSelectedNFTId(e.target.value);
              }}
            >
              {nfts
                .filter((nft) => nft.id !== id) // filter out the current nft
                .map((nft) => {
                  return (
                    <MenuItem key={nft.id} value={nft.id}>
                      <div className="flex w-full items-center justify-between">
                        <Typography>#{nft.id}</Typography>
                        <div>
                          <Typography>
                            {formatCurrency(nft.lockValue)}
                          </Typography>
                          <Typography color="textSecondary">
                            {veToken?.symbol}
                          </Typography>
                        </div>
                      </div>
                    </MenuItem>
                  );
                })}
            </Select>
          </FormControl>
          <Button
            disabled={!selectedNFTId}
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            className="bg-[#272826] font-bold text-cantoGreen hover:bg-green-900"
            onClick={() => onMergeNFT(id as string, selectedNFTId)}
          >
            Merge
          </Button>
        </div>
      </Paper>
    </div>
  );
}
