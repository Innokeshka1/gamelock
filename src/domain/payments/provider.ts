import type { Currency, PaymentStatus } from "../types";

/**
 * Payment provider abstraction. The UI and store only talk to this interface,
 * so the mock can later be swapped for Stellar (or any other provider).
 */
export interface PaymentProvider {
  id: string;
  createPayment(input: { bookingId: string; amount: number; currency: Currency }): Promise<{ providerRef: string; status: PaymentStatus }>;
  confirmPayment(providerRef: string): Promise<{ status: PaymentStatus }>;
  refundPayment(providerRef: string, amount: number): Promise<{ status: PaymentStatus }>;
  getPaymentStatus(providerRef: string): Promise<PaymentStatus>;
}
