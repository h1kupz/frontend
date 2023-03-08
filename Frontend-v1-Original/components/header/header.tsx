import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";

import {
  Typography,
  Button,
  SvgIcon,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { withStyles, withTheme } from "@mui/styles";
import {
  List,
  ArrowDropDown,
  AccountBalanceWalletOutlined,
  DashboardOutlined,
} from "@mui/icons-material";

import Navigation from "../navigation/navigation";
import Unlock from "../unlock/unlockModal";
import TransactionQueue from "../transactionQueue/transactionQueue";

import { ACTIONS } from "../../stores/constants/constants";

import stores from "../../stores";
import { formatAddress } from "../../utils/utils";

import classes from "./header.module.css";

type EthWindow = Window &
  typeof globalThis & {
    ethereum?: any;
  };

function SiteLogo(props: { className: string }) {
  const { className } = props;
  return (
    <Image
      className={className}
      src="/images/vcm_logo.png"
      alt="velocimeter logo"
      height={38}
      width={256}
    />
  );
}

const { CONNECT_WALLET, ACCOUNT_CONFIGURED, ACCOUNT_CHANGED } = ACTIONS;

function WrongNetworkIcon(props: { className: string }) {
  const { className } = props;
  return (
    <SvgIcon viewBox="0 0 64 64" strokeWidth="1" className={className}>
      <g strokeWidth="2" transform="translate(0, 0)">
        <path
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="square"
          strokeMiterlimit="10"
          d="M33.994,42.339 C36.327,43.161,38,45.385,38,48c0,3.314-2.686,6-6,6c-2.615,0-4.839-1.673-5.661-4.006"
          strokeLinejoin="miter"
        ></path>{" "}
        <path
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="square"
          strokeMiterlimit="10"
          d="M47.556,32.444 C43.575,28.462,38.075,26,32,26c-6.075,0-11.575,2.462-15.556,6.444"
          strokeLinejoin="miter"
        ></path>{" "}
        <path
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="square"
          strokeMiterlimit="10"
          d="M59.224,21.276 C52.256,14.309,42.632,10,32,10c-10.631,0-20.256,4.309-27.224,11.276"
          strokeLinejoin="miter"
        ></path>{" "}
        <line
          data-color="color-2"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="square"
          strokeMiterlimit="10"
          x1="10"
          y1="54"
          x2="58"
          y2="6"
          strokeLinejoin="miter"
        ></line>
      </g>
    </SvgIcon>
  );
}

const StyledMenuItem = withStyles((theme) => ({
  root: {
    "&:focus": {
      backgroundColor: "none",
      "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
        color: "#FFF",
      },
    },
  },
}))(MenuItem);

const StyledBadge = withStyles((theme) => ({
  badge: {
    background: "#06D3D7",
    color: "#000",
  },
}))(Badge);

const switchChain = async () => {
  let hexChain = "0x" + Number(process.env.NEXT_PUBLIC_CHAINID).toString(16);
  try {
    await (window as EthWindow).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChain }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await (window as EthWindow).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChain,
              chainName: "Canto",
              nativeCurrency: {
                name: "CANTO",
                symbol: "CANTO",
                decimals: 18,
              },
              rpcUrls: [
                "https://canto.slingshot.finance/",
                "https://canto.gravitychain.io/",
                "https://canto.neobase.one/",
                "https://canto.evm.chandrastation.com/",
                "https://jsonrpc.canto.nodestake.top/",
              ],
              blockExplorerUrls: [
                "https://tuber.build/",
                "https://evm.explorer.canto.io/",
              ],
            },
          ],
        });
      } catch (addError) {
        console.log("add error", addError);
      }
    }
    console.log("switch error", switchError);
  }
};

function Header() {
  const accountStore = stores.accountStore.getStore("account");
  const router = useRouter();

  const [account, setAccount] = useState(accountStore);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [chainInvalid, setChainInvalid] = useState(false);
  const [transactionQueueLength, setTransactionQueueLength] = useState(0);

  useEffect(() => {
    // The debounce function receives our function as a parameter
    const debounce = (fn) => {
      // This holds the requestAnimationFrame reference, so we can cancel it if we wish
      let frame;
      // The debounce function returns a new function that can receive a variable number of arguments
      return (...params) => {
        // If the frame variable has been defined, clear it now, and queue for next frame
        if (frame) {
          cancelAnimationFrame(frame);
        }
        // Queue our function call for the next frame
        frame = requestAnimationFrame(() => {
          // Call our function and pass any params we received
          fn(...params);
        });
      };
    };

    // Reads out the scroll position and stores it in the data attribute
    // so we can use it in our stylesheets
    const storeScroll = () => {
      document.documentElement.dataset.scroll = window.scrollY.toString();
    };

    // Listen for new scroll events, here we debounce our `storeScroll` function
    document.addEventListener("scroll", debounce(storeScroll), {
      passive: true,
    });

    // Update scroll position for first time
    storeScroll();

    return () => {
      document.removeEventListener("scroll", debounce(storeScroll));
    };
  }, []);

  useEffect(() => {
    const accountConfigure = () => {
      const accountStore = stores.accountStore.getStore("account");
      setAccount(accountStore);
      closeUnlock();
    };
    const connectWallet = () => {
      onAddressClicked();
    };
    const accountChanged = () => {
      const invalid = stores.accountStore.getStore("chainInvalid");
      setChainInvalid(invalid);
    };

    const invalid = stores.accountStore.getStore("chainInvalid");
    setChainInvalid(invalid);

    stores.emitter.on(ACCOUNT_CONFIGURED, accountConfigure);
    stores.emitter.on(CONNECT_WALLET, connectWallet);
    stores.emitter.on(ACCOUNT_CHANGED, accountChanged);
    return () => {
      stores.emitter.removeListener(ACCOUNT_CONFIGURED, accountConfigure);
      stores.emitter.removeListener(CONNECT_WALLET, connectWallet);
      stores.emitter.removeListener(ACCOUNT_CHANGED, accountChanged);
    };
  }, []);

  const onAddressClicked = () => {
    setUnlockOpen(true);
  };

  const closeUnlock = () => {
    setUnlockOpen(false);
  };

  const setQueueLength = (length) => {
    setTransactionQueueLength(length);
  };

  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <div className={classes.headerContainer}>
        <a
          onClick={() => router.push("/home")}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-[40px] py-1"
        >
          <SiteLogo className={classes.appLogo} />
        </a>
        <Navigation />
        <div
          style={{
            width: "260px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {process.env.NEXT_PUBLIC_CHAINID === "740" && (
            <div className={classes.testnetDisclaimer}>
              <Typography className={classes.testnetDisclaimerText}>
                Testnet
              </Typography>
            </div>
          )}
          {transactionQueueLength > 0 && (
            <IconButton
              className={classes.accountButton}
              color="primary"
              onClick={() => {
                stores.emitter.emit(ACTIONS.TX_OPEN);
              }}
            >
              <StyledBadge
                badgeContent={transactionQueueLength}
                color="secondary"
                overlap="circular"
              >
                <List className={classes.iconColor} />
              </StyledBadge>
            </IconButton>
          )}
          {account && account.address ? (
            <div>
              <Button
                disableElevation
                className={classes.accountButton}
                variant="contained"
                color="primary"
                aria-controls="simple-menu"
                aria-haspopup="true"
                onClick={handleClick}
              >
                <div
                  className={`${classes.accountIcon} ${classes.metamask}`}
                ></div>
                <Typography className={classes.headBtnTxt}>
                  {formatAddress(account.address)}
                </Typography>
                <ArrowDropDown className={classes.ddIcon} />
              </Button>
              <Menu
                elevation={0}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                id="customized-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
                className={classes.userMenu}
              >
                <StyledMenuItem onClick={onAddressClicked}>
                  <ListItemIcon className={classes.userMenuIcon}>
                    <AccountBalanceWalletOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    className={classes.userMenuText}
                    primary="Switch Wallet Provider"
                  />
                </StyledMenuItem>
              </Menu>
            </div>
          ) : (
            <Button
              disableElevation
              className={classes.accountButton}
              variant="contained"
              color={"primary"}
              onClick={onAddressClicked}
            >
              <Typography className={classes.headBtnTxt}>
                Connect Wallet
              </Typography>
            </Button>
          )}
        </div>
        {unlockOpen && (
          <Unlock modalOpen={unlockOpen} closeModal={closeUnlock} />
        )}
        <TransactionQueue setQueueLength={setQueueLength} />
      </div>
      {chainInvalid ? (
        <div className={classes.chainInvalidError}>
          <div className={classes.ErrorContent}>
            <WrongNetworkIcon className={classes.networkIcon} />
            <Typography className={classes.ErrorTxt}>
              The chain you're connected to isn't supported. Please check that
              your wallet is connected to Canto Mainnet.
            </Typography>
            <Button
              className={classes.switchNetworkBtn}
              variant="contained"
              onClick={() => switchChain()}
            >
              Switch to{" "}
              {process.env.NEXT_PUBLIC_CHAINID == "740"
                ? "Canto testnet"
                : "Canto"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default withTheme(Header);
