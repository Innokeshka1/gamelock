import { beforeEach, describe, expect, it, vi } from "vitest";
const wallet = vi.hoisted(() => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getNetworkDetails: vi.fn(),
  signTransaction: vi.fn(),
}));
vi.mock("@stellar/freighter-api", () => wallet);
import { connectPlayerWallet, signPlayerPayment } from "./freighter.client";
beforeEach(() => {
  vi.resetAllMocks();
  wallet.isConnected.mockResolvedValue({ isConnected: true });
  wallet.requestAccess.mockResolvedValue({ address: "player" });
  wallet.getNetworkDetails.mockResolvedValue({
    networkPassphrase: "Test SDF Network ; September 2015",
  });
});
describe("Freighter browser boundary", () => {
  it("connects and requests a Testnet signature only in Freighter", async () => {
    expect(await connectPlayerWallet()).toBe("player");
    wallet.signTransaction.mockResolvedValue({ signedTxXdr: "signed", signerAddress: "player" });
    expect(await signPlayerPayment("unsigned", "player")).toBe("signed");
    expect(wallet.signTransaction).toHaveBeenCalledWith("unsigned", {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "player",
    });
  });
  it("rejects mainnet before signing", async () => {
    wallet.getNetworkDetails.mockResolvedValue({
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });
    await expect(connectPlayerWallet()).rejects.toThrow(/Testnet/);
    await expect(signPlayerPayment("unsigned", "player")).rejects.toThrow(/Testnet/);
    expect(wallet.signTransaction).not.toHaveBeenCalled();
  });
  it("handles absent wallet, declined access, declined signature and account switch", async () => {
    wallet.isConnected.mockResolvedValueOnce({ isConnected: false });
    await expect(connectPlayerWallet()).rejects.toThrow(/Freighter/);
    wallet.requestAccess.mockResolvedValueOnce({ error: { message: "Declined" } });
    await expect(connectPlayerWallet()).rejects.toThrow(/Declined/);
    wallet.signTransaction.mockResolvedValueOnce({ error: { message: "Declined" } });
    await expect(signPlayerPayment("unsigned", "player")).rejects.toThrow(/Declined/);
    wallet.signTransaction.mockResolvedValueOnce({ signedTxXdr: "signed", signerAddress: "other" });
    await expect(signPlayerPayment("unsigned", "player")).rejects.toThrow(/different/);
  });
});
