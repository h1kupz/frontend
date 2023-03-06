import { Paper } from "@mui/material";
import Setup from "./setup";

function Swap() {
  return (
    <div className="mt-32 flex h-full min-h-[calc(100vh-432px)] w-full flex-col items-center justify-evenly sm:mt-0 lg:flex-row">
      <Paper
        elevation={0}
        className="flex w-full max-w-[485px] flex-col p-3 shadow-lg shadow-cantoGreen lg:p-6"
      >
        <Setup />
      </Paper>
    </div>
  );
}

export default Swap;
