import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

const TESTNET = "Test SDF Network ; September 2015";

export async function connectPlayerWallet(): Promise<string> {
  const installed = await isConnected();
  if (installed.error || !installed.isConnected)
    throw new Error("Install and unlock the Freighter browser extension.");
  const access = await requestAccess();
  if (access.error || !access.address)
    throw new Error(access.error?.message ?? "Freighter connection was declined.");
  await requireTestnet();
  return access.address;
}

async function requireTestnet() {
  const network = await getNetworkDetails();
  if (network.error || network.networkPassphrase !== TESTNET)
    throw new Error("Select Testnet in Freighter, then try again.");
}

export async function signPlayerPayment(xdr: string, payer: string): Promise<string> {
  await requireTestnet();
  const result = await signTransaction(xdr, { networkPassphrase: TESTNET, address: payer });
  if (result.error || !result.signedTxXdr)
    throw new Error(result.error?.message ?? "Payment signature was declined.");
  if (result.signerAddress !== payer) throw new Error("Freighter signed with a different wallet.");
  return result.signedTxXdr;
}
