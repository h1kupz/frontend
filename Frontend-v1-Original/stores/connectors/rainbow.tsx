import { getDefaultWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { canto } from "wagmi/chains";

const { chains, provider } = configureChains(
  [canto],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `https://canto.dexvaults.com`,
      }),
    }),
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `https://mainnode.plexnode.org:8545`,
      }),
    }),
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `https://canto.slingshot.finance`,
      }),
    }),
  ]
);
const { connectors } = getDefaultWallets({
  appName: "My RainbowKit App",
  projectId: "aa9bd3a3710b5c6ac981c2d222a90d49",
  chains,
});
const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

export default function RainbowWagmi({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains} initialChain={canto}>
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
