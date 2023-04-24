import { useAccount } from "../../../hooks/useAccount";
import { MergeNFT } from "../../../components/ssVest/MergeNFT";

export default function MergeInto() {
  const account = useAccount();
  return (
    <div className="relative mt-0 flex h-full w-full flex-col pt-8">
      {account && account.address ? <MergeNFT /> : null}
    </div>
  );
}
