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
          Migration from v1 to v2 is CLOSED.
          <br />
          The migration happened on 16th of March.
          <br />
          Here is a link to{" "}
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
          This is a v1 app! This app is deprecated and will be shut down.
        </div>
      </div>
    </Dialog>
  );
}
