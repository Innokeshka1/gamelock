import type { PaymentStatus } from "../types";
import type { PaymentProvider } from "./provider";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statuses = new Map<string, PaymentStatus>();

export const mockPaymentProvider: PaymentProvider = {
  id: "mock",
  async createPayment({ bookingId }) {
    const providerRef = `mock_${bookingId}_${Date.now().toString(36)}`;
    statuses.set(providerRef, "pending");
    return { providerRef, status: "pending" };
  },
  async confirmPayment(providerRef) {
    await wait(1200);
    statuses.set(providerRef, "successful");
    return { status: "successful" };
  },
  async refundPayment(providerRef) {
    await wait(600);
    statuses.set(providerRef, "refund_pending");
    return { status: "refund_pending" };
  },
  async getPaymentStatus(providerRef) {
    return statuses.get(providerRef) ?? "pending";
  },
};

export const paymentProvider: PaymentProvider = mockPaymentProvider;
