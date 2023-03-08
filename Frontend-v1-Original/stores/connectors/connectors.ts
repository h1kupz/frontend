import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { WalletLinkConnector } from "@web3-react/walletlink-connector";
import { NetworkConnector } from "@web3-react/network-connector";

const chainId = process.env.NEXT_PUBLIC_CHAINID ?? "7700";

const POLLING_INTERVAL = 12000;
const RPC_URLS = {
  740: "https://eth.plexnode.wtf/",
  7700: "https://canto.slingshot.finance/", //TODO set it to new node
};

let obj: {
  [key: number]: string;
} = {
  7700: RPC_URLS[7700],
};

if (chainId === "740") {
  obj = { 740: RPC_URLS[740] };
}

export const network = new NetworkConnector({ urls: obj });

export const injected = new InjectedConnector({
  supportedChainIds: [parseInt(chainId)],
});

export const walletconnect = new WalletConnectConnector({
  rpc: obj,
  chainId: parseInt(chainId),
  bridge: "https://bridge.walletconnect.org",
  qrcode: true,
});

export const walletlink = new WalletLinkConnector({
  // @ts-expect-error - assume it's right always - hard to make error
  url: RPC_URLS[chainId],
  appName: "Velocimeter",
  supportedChainIds: [parseInt(chainId)],
});
