import "@tanstack/react-start/server-only";
import type { PaymentProvider } from "./provider";
import { mockPaymentProvider } from "./mock-provider";
import { readTrustlessWorkConfig } from "./stellar-config.server";
import { ProviderNotReadyError, TrustlessWorkProvider } from "./trustless-work-provider.server";
import { NativeStellarProvider } from "./native-stellar.server";

export function getPaymentProvider(
  env: Record<string, string | undefined> = process.env,
): PaymentProvider | TrustlessWorkProvider | NativeStellarProvider {
  const selected = env["PAYMENT_PROVIDER"] ?? "mock";
  if (selected === "mock") return mockPaymentProvider;
  if (selected === "stellar-native") return new NativeStellarProvider(env);
  if (selected === "trustless-work") return new TrustlessWorkProvider(readTrustlessWorkConfig(env));
  throw new Error("PAYMENT_PROVIDER must be mock, stellar-native or trustless-work");
}

/** Fail before DB writes if someone selects the not-yet-integrated live provider. */
export function getBookingPaymentProvider(
  env: Record<string, string | undefined> = process.env,
): PaymentProvider {
  const provider = getPaymentProvider(env);
  if (provider.id === "trustless-work") throw new ProviderNotReadyError();
  return provider;
}
