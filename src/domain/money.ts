import type { Currency } from "./types";

export function formatMoney(amount: number, currency: Currency, locale = "en-GB"): string {
  const value = amount / 10 ** currency.minorUnits;
  const whole = amount % 10 ** currency.minorUnits === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: whole ? 0 : currency.minorUnits,
    maximumFractionDigits: currency.minorUnits,
  }).format(value);
}

/** Always shows decimals — for receipts and totals. */
export function formatMoneyExact(amount: number, currency: Currency, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.minorUnits,
  }).format(amount / 10 ** currency.minorUnits);
}

export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}
