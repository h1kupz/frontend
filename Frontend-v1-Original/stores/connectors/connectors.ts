import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { WalletLinkConnector } from "@web3-react/walletlink-connector";
import { NetworkConnector } from "@web3-react/network-connector";

const POLLING_INTERVAL = 12000;
const RPC_URLS = {
  740: "https://eth.plexnode.wtf/",
  7700: "https://canto.slingshot.finance/",
  421613: "https://goerli-rollup.arbitrum.io/rpc",
};

let obj: {
  [key: number]: string;
} = {
  421613: RPC_URLS[421613],
};

if (process.env.NEXT_PUBLIC_CHAINID === "740") {
  obj = { 740: RPC_URLS[740] };
}

export const network = new NetworkConnector({ urls: obj });

export const injected = new InjectedConnector({
  supportedChainIds: [parseInt(process.env.NEXT_PUBLIC_CHAINID)],
});

export const walletconnect = new WalletConnectConnector({
  rpc: obj,
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAINID),
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});

export const walletlink = new WalletLinkConnector({
  url: RPC_URLS[process.env.NEXT_PUBLIC_CHAINID],
  appName: "Velocimeter",
  supportedChainIds: [parseInt(process.env.NEXT_PUBLIC_CHAINID)],
});
