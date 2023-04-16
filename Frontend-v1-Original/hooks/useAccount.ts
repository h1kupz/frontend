import { useState, useEffect } from "react";
import stores from "../stores";
import {
  ACCOUNT_CHANGED,
  ACCOUNT_CONFIGURED,
} from "../stores/constants/actions";

export function useAccount() {
  const [account, setAccount] = useState(
    stores.accountStore.getStore("account")
  );
  useEffect(() => {
    const accountChanged = () => {
      const account = stores.accountStore.getStore("account");
      setAccount(account);
    };

    stores.emitter.on(ACCOUNT_CHANGED, accountChanged);
    stores.emitter.on(ACCOUNT_CONFIGURED, accountChanged);

    return () => {
      stores.emitter.removeListener(ACCOUNT_CHANGED, accountChanged);
      stores.emitter.removeListener(ACCOUNT_CONFIGURED, accountChanged);
    };
  }, []);

  return account;
}
