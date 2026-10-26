/** EURC precision is asset metadata, distinct from the game's price minor units. */
export const EURC_DECIMALS = 7;
const SCALE = 10n ** BigInt(EURC_DECIMALS);
const MAX_I128 = (1n << 127n) - 1n;

export function atomicAmount(value: string): bigint {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error("Invalid nonnegative atomic amount");
  const n = BigInt(value);
  if (n > MAX_I128) throw new Error("Amount exceeds token i128 range");
  return n;
}

export function eurcToAtomic(value: string): string {
  if (!/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value))
    throw new Error("EURC amount must have at most seven decimal places");
  const [whole, fraction = ""] = value.split(".");
  const result = (BigInt(whole!) * SCALE + BigInt(fraction.padEnd(EURC_DECIMALS, "0"))).toString();
  atomicAmount(result);
  return result;
}

export function atomicToEurc(value: string): string {
  const n = atomicAmount(value);
  return `${n / SCALE}.${(n % SCALE).toString().padStart(EURC_DECIMALS, "0")}`;
}

export function minorUnitsToEurcAtomic(amount: number, minorUnits: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Price must be a nonnegative safe integer");
  if (!Number.isInteger(minorUnits) || minorUnits < 0 || minorUnits > EURC_DECIMALS)
    throw new Error("Unsupported currency precision");
  return (BigInt(amount) * 10n ** BigInt(EURC_DECIMALS - minorUnits)).toString();
}

/** Mirrors existing positive-money half-up rounding at the chosen base-unit precision. */
export function refundAtomic(
  paidAtomic: string,
  percent: number,
  roundingDecimals = EURC_DECIMALS,
): string {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100)
    throw new Error("Refund percent must be an integer between 0 and 100");
  if (
    !Number.isInteger(roundingDecimals) ||
    roundingDecimals < 0 ||
    roundingDecimals > EURC_DECIMALS
  )
    throw new Error("Invalid refund rounding precision");
  const quantum = 10n ** BigInt(EURC_DECIMALS - roundingDecimals);
  const paid = atomicAmount(paidAtomic);
  if (paid % quantum !== 0n)
    throw new Error("Paid amount does not match business currency precision");
  return ((((paid / quantum) * BigInt(percent) + 50n) / 100n) * quantum).toString();
}
