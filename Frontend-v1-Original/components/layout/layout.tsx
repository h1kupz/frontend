import { useEffect } from "react";
import Head from "next/head";
import classes from "./layout.module.css";
import Header from "../header/header";
import MobileHeader from "../header/mobileHeader";
import SnackbarController from "../snackbar/snackbarController";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useAccount, useConnect, useNetwork, useSigner } from "wagmi";
import stores from "../../stores";
import { ACTIONS } from "../../stores/constants/constants";

export default function Layout({
  children,
  configure,
}: {
  children: React.ReactNode;
  configure?: boolean;
}) {
  const { data: signerData } = useSigner({
    chainId: 7700,
  });
  const { address } = useAccount({});
  const { chain } = useNetwork();

  useEffect(() => {
    if (signerData) {
      stores.accountStore.setStore({ wagmiSigner: signerData });
    }
    if (address) {
      stores.accountStore.setStore({ account: { address } });
      stores.dispatcher.dispatch({
        type: ACTIONS.CONFIGURE_SS,
        content: { connected: true },
      });
    } else {
      stores.accountStore.setStore({ account: null });
    }
    if (chain?.unsupported) {
      stores.accountStore.setStore({ chainInvalid: true });
    }
  }, [signerData, address, chain]);

  return (
    <div className={classes.container}>
      <Head>
        <link rel="icon" href="/images/logo-icon.png" />
        <link
          rel="preload"
          href="/fonts/Inter/Inter-Regular.ttf"
          as="font"
          crossOrigin=""
        />
        <meta
          name="description"
          content="Velocimeter allows low cost, near 0 slippage trades on uncorrelated or tightly correlated assets built on Canto."
        />
        <meta name="og:title" content="Velocimeter" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <div className={classes.background} />
      <div className={classes.greyGlow} />
      <div className={classes.greenGlow} />
      <div className={classes.content}>
        {!configure && (
          <>
            <div className="block md:hidden">
              <MobileHeader />
            </div>
            <div className="sticky top-0 z-10 hidden md:block">
              <Header />
              <ConnectButton />
            </div>
          </>
        )}
        <SnackbarController />
        <main>{children}</main>
      </div>
    </div>
  );
}
