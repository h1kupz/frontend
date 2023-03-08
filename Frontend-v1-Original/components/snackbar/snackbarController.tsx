import React, { Component } from "react";
import { withStyles } from "@mui/styles";

import Snackbar from "./snackbar";

import { ACTIONS } from "../../stores/constants/constants";

import stores from "../../stores";
const emitter = stores.emitter;

const styles = (theme) => ({
  root: {},
});

const SnackbarController = (props) => {
  const [state, setState] = React.useState({
    open: false,
    snackbarType: null,
    snackbarMessage: null,
  });

  React.useEffect(() => {
    const showError = (error) => {
      const snackbarObj = {
        snackbarMessage: null,
        snackbarType: null,
        open: false,
      };
      setState(snackbarObj);

      if (process.env.NODE_ENV === "development") {
        setTimeout(() => {
          const snackbarObj = {
            snackbarMessage: error.toString(),
            snackbarType: "Error",
            open: true,
          };
          setState(snackbarObj);
        });
      }
    };

    const showHash = ({ txHash }) => {
      const snackbarObj = {
        snackbarMessage: null,
        snackbarType: null,
        open: false,
      };
      setState(snackbarObj);

      setTimeout(() => {
        const snackbarObj = {
          snackbarMessage: txHash,
          snackbarType: "Hash",
          open: true,
        };
        setState(snackbarObj);
      });
    };

    const showWarn = ({ warning }: { warning: string }) => {
      const snackbarObj = {
        snackbarMessage: null,
        snackbarType: null,
        open: false,
      };
      setState(snackbarObj);

      setTimeout(() => {
        const snackbarObj = {
          snackbarMessage: warning,
          snackbarType: "Warning",
          open: true,
        };
        setState(snackbarObj);
      });
    };

    emitter.on(ACTIONS.ERROR, showError);
    emitter.on(ACTIONS.TX_SUBMITTED, showHash);
    emitter.on(ACTIONS.WARNING, showWarn);
    return () => {
      emitter.removeListener(ACTIONS.ERROR, showError);
      emitter.removeListener(ACTIONS.TX_SUBMITTED, showHash);
      emitter.removeListener(ACTIONS.WARNING, showWarn);
    };
  }, []);

  const { snackbarType, snackbarMessage, open } = state;
  return (
    <>
      {open ? (
        <Snackbar type={snackbarType} message={snackbarMessage} open={true} />
      ) : (
        <div />
      )}
    </>
  );
};

export default withStyles(styles)(SnackbarController);
