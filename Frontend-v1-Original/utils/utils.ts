import BigNumber from "bignumber.js";

export function formatCurrency(
  amount: string | number | BigNumber | undefined,
  decimals = 2
) {
  if (!amount) return 0;
  // FIXME
  // @ts-expect-error temporary When the argument to the isNaN() function is not of type Number, the value is first coerced to a number, and the resulting value is then compared against NaN.
  if (!isNaN(amount)) {
    if (BigNumber(amount).gt(0) && BigNumber(amount).lt(0.01)) {
      return "< 0.01";
    }

    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    // FIXME
    // @ts-expect-error temporary When the argument to the isNaN() function is not of type Number, the value is first coerced to a number, and the resulting value is then compared against NaN.
    return formatter.format(amount);
  } else {
    return 0;
  }
}

export function formatAddress(address: string, length = "short") {
  let shortenAddress: string;
  if (address && length === "short") {
    shortenAddress =
      address.substring(0, 6) +
      "..." +
      address.substring(address.length - 4, address.length);
    return shortenAddress;
  } else if (address && length === "long") {
    shortenAddress =
      address.substring(0, 12) +
      "..." +
      address.substring(address.length - 8, address.length);
    return shortenAddress;
  } else {
    return null;
  }
}

export function formatMooTokenSymbol(input: string): string {
  if (input.includes("mooCanto")) {
    return input.replace("mooCanto", "");
  } else return input;
}

export function formatMooPairSymbol(input: string): string {
  const parts = input.split("/");
  const formattedParts = parts.map((part) => formatMooTokenSymbol(part));
  return "moo: " + formattedParts.join("/");
}
