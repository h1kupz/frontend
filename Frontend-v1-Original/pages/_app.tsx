import React, { useState, useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import Layout from "../components/layout/layout";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useRouter } from "next/router";

import lightTheme from "../theme/light";
import darkTheme from "../theme/dark";

import Configure from "./configure";

import stores from "../stores/index";

import { ACTIONS } from "../stores/constants/constants";
import "../styles/global.css";

console.log("<<<<<<<<<<<<< flow >>>>>>>>>>>>>");

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const [themeConfig, setThemeConfig] = useState(darkTheme);
  const [stalbeSwapConfigured, setStableSwapConfigured] = useState(false);
  const [accountConfigured, setAccountConfigured] = useState(false);

  useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side");
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles);
    }
  }, []);

  const accountConfigureReturned = () => {
    setAccountConfigured(true);
  };

  const stableSwapConfigureReturned = () => {
    setStableSwapConfigured(true);
  };

  useEffect(function () {
    stores.emitter.on(ACTIONS.CONFIGURED_SS, stableSwapConfigureReturned);
    stores.emitter.on(ACTIONS.ACCOUNT_CONFIGURED, accountConfigureReturned);

    stores.dispatcher.dispatch({ type: ACTIONS.CONFIGURE });

    return () => {
      stores.emitter.removeListener(
        ACTIONS.CONFIGURED_SS,
        stableSwapConfigureReturned
      );
      stores.emitter.removeListener(
        ACTIONS.ACCOUNT_CONFIGURED,
        accountConfigureReturned
      );
    };
  }, []);

  const validateConfigured = () => {
    switch (router.pathname) {
      case "/":
        return accountConfigured;
      default:
        return accountConfigured;
    }
  };

  return (
    <React.Fragment>
      <Head>
        <title>Velocimeter</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      <ThemeProvider theme={themeConfig}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        {validateConfigured() && (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        )}
        {!validateConfigured() && <Configure {...pageProps} />}
      </ThemeProvider>
    </React.Fragment>
  );
}
