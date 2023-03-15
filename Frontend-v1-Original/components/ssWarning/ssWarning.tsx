import { Dialog } from "@mui/material";

export default function ffWarning({ close }) {
  return (
    <Dialog open={true} onClose={close} className="fixed z-[10030]">
      <div className="flex max-w-lg flex-col items-center justify-center rounded-[10px] border border-cantoGreen p-10">
        <img src="/images/icon-warning.svg" className="mb-4 h-10" />
        <div className="mb-4 text-xl font-extrabold leading-none tracking-tight text-white md:text-2xl lg:text-4xl">
          Migration Warning
        </div>
        <div className="mb-3 text-base font-light text-lime-50">
          Migration from v1 to v2 is LIVE.
          <br />
          The migration steps for everyone are straightforward:
          <br />
          1. veFLOW holders were airdropped new veFLOW.
          <br />
          2. FLOW_v1 holders & farmers should claim any remaining FLOW_v1
          emissions and convert their tokens to FLOW_v2 via the MIGRATION tab on
          the{" "}
          <a
            href="https://www.velocimeter.xyz/migration"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-cantoGreen hover:underline"
          >
            v2 app
          </a>
          .
          <br />
          3. Liquidity providers should break their liquidity from the{" "}
          <a
            href="https://canto.velocimeter.xyz/liquidity"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-cantoGreen hover:underline"
          >
            v1 app
          </a>{" "}
          and add it to the{" "}
          <a
            href="https://www.velocimeter.xyz/liquidity"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-cantoGreen hover:underline"
          >
            v2 app
          </a>
          .
        </div>
        <div className="text-base font-normal text-lime-50">
          Pay Careful attention to the epoch timer!
          <br />
          <span className="font-semibold">
            FLOW_v1 is only be redeemable for FLOW_v2 prior to the subsequent
            epoch flip (00:00 UTC Thursday).
          </span>
          <br />
          This is to avoid the V1 to continue to be farmed and converted. We
          encourage those who want to add liquidity to FLOW pairs on v2 to do
          so.
          <br />
          Shortly before epoch timer is up we will Kill all the gauges on v1
          app.{" "}
          <span className="font-semibold">
            You MUST have your rewards claimed before this time.
          </span>{" "}
          You won&apos;t be able to claim rewards after the epoch flip on v1
          app.
          <br />
          We will also empty the redeemer shorter after the epoch flip. So
          migrate your v1 FLOW sooner than later.
        </div>
      </div>
    </Dialog>
  );
}
