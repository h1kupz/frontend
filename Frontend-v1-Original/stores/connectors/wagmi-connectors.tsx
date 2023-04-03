import {
  darkTheme,
  getDefaultWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import { canto } from "wagmi/chains";
import { jsonRpcProvider } from "@wagmi/core/providers/jsonRpc";

const { chains, provider } = configureChains(
  [canto],
  [
    jsonRpcProvider({
      rpc: () => ({
        http: `https://canto.dexvaults.com`,
      }),
      static: true,
    }),
    jsonRpcProvider({
      rpc: () => ({
        http: `https://canto.evm.chandrastation.com`,
      }),
      static: true,
    }),
    jsonRpcProvider({
      rpc: () => ({
        http: `https://jsonrpc.canto.nodestake.top`,
      }),
      static: true,
    }),
  ]
);

const { connectors } = getDefaultWallets({
  appName: "Velocimeter",
  chains,
});

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

export const Wagmi = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        initialChain={canto}
        theme={darkTheme()}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
};
