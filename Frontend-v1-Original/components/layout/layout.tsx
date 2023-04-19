import { useEffect } from "react";
import Head from "next/head";
import classes from "./layout.module.css";
import Header from "../header/header";
import MobileHeader from "../header/mobileHeader";
import SnackbarController from "../snackbar/snackbarController";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useSigner } from "wagmi";
import stores from "../../stores";

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

  useEffect(() => {
    if (signerData) {
      stores.accountStore.setStore({ wagmiSigner: signerData });
    }
  }, [signerData]);

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
