import { Paper, Button, Typography } from "@mui/material";
import Setup from "./setup";

const v2 = process.env.NEXT_PUBLIC_V === "v2";

function Migration() {
  return (
    <div className="mt-32 flex h-full min-h-[calc(100vh-432px)] w-full flex-col items-center justify-evenly gap-16 sm:mt-0">
      <Paper
        elevation={0}
        className="flex w-full max-w-[485px] flex-col p-3 shadow-md shadow-cantoGreen lg:p-6"
      >
        {v2 ? (
          <Setup />
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center">
            <Typography
              className="text-center font-['Monument'] text-2xl font-thin text-white sm:text-3xl"
              variant="h1"
            >
              Migration
            </Typography>
            <Typography
              className="color-[#7e99b0] my-7 mx-auto max-w-3xl text-center text-base sm:text-lg"
              variant="body2"
            >
              Redeem FLOW v2 for your FLOW v1 tokens. Migrate LP.
              <br />
              Feel the Flow.
            </Typography>
            <Button
              disableElevation
              className="scale-90 rounded-3xl border border-solid border-green-300 bg-green-300 px-6 pt-3 pb-4 font-bold transition-all duration-300 hover:scale-95 hover:bg-emerald-300"
              variant="contained"
              onClick={() =>
                window.open("https://velocimeter.xyz/migration", "_blank")
              }
            >
              <Typography>Go to Velocimeter v2</Typography>
            </Button>
          </div>
        )}
      </Paper>
      {v2 && (
        <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-cantoGreen bg-black p-4 tracking-wide text-green-100 md:max-w-xl">
          <div>
            This is a page for Velocimeter v1 to v2 migration.
            <br />
            Flow v1 to Flow v2 tokens redemption rate is 1:1.
            <br />
            In order to migrate liquidity from v1 to v2, you need to withdraw
            your v1 LP and deposit in v2 interface. Keep in mind that if you
            provide liquidity for FLOW token you also need to redeem your FLOW
            v1 to FLOW v2.
          </div>
          <div className="">Stay with the flow.</div>
        </div>
      )}
    </div>
  );
}

export default Migration;
