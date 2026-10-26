import { Account, Asset, Contract, TransactionBuilder, BASE_FEE, rpc, scValToNative, Address, xdr } from '@stellar/stellar-sdk';
import { NETWORK, RPC, HORIZON, TOKEN, ISSUER, SYMBOL } from './config.mjs';

export const chain = new rpc.Server(RPC, { timeout: 30000 });
export async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Public data request failed: HTTP ${response.status}`);
  return response.json();
}

export async function rpcCall(method, params) {
  const response = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`Stellar RPC ${method} failed (code ${data.error?.code ?? response.status})`);
  return data.result;
}

export async function readToken(method, address) {
  // Read-only simulation using the public issuer as transaction source. No keys/signatures.
  const account = await json(`${HORIZON}/accounts/${ISSUER}`);
  const tx = new TransactionBuilder(new Account(ISSUER, account.sequence), { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(new Contract(TOKEN).call(method, ...(address ? [new Address(address).toScVal()] : [])))
    .setTimeout(60).build();
  const result = await chain.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) throw new Error(`Token ${method} read-only simulation failed`);
  return scValToNative(result.result.retval);
}

export async function verifyAsset() {
  const network = await chain.getNetwork();
  if (network.passphrase !== NETWORK) throw new Error('RPC is not Stellar Testnet');
  const derivedContract = new Asset(SYMBOL, ISSUER).contractId(NETWORK);
  if (derivedContract !== TOKEN) throw new Error('Issuer/symbol derive a different Testnet token contract');
  const assets = await json(`${HORIZON}/assets?asset_code=${SYMBOL}&asset_issuer=${ISSUER}`);
  const asset = assets._embedded?.records?.find(a => a.asset_code === SYMBOL && a.asset_issuer === ISSUER);
  if (asset?.contract_id !== TOKEN) throw new Error('Horizon asset/contract identity mismatch');
  const decimals = await readToken('decimals');
  const symbol = await readToken('symbol');
  if (symbol !== SYMBOL || decimals !== 7) throw new Error('Unexpected EURC symbol or decimal precision');
  return { network: network.passphrase, token: TOKEN, issuer: ISSUER, symbol, decimals, derivedContract, verifiedAt: new Date().toISOString(), method: 'Horizon + SDK SAC derivation + Soroban token simulation' };
}

export async function accountReadiness(address, requiredEurc = 0) {
  const account = await json(`${HORIZON}/accounts/${address}`);
  const eurc = account.balances.find(b => b.asset_code === SYMBOL && b.asset_issuer === ISSUER);
  const xlm = account.balances.find(b => b.asset_type === 'native');
  if (!eurc || eurc.is_authorized === false || Number(eurc.balance) < requiredEurc) throw new Error(`STOP: ${address} needs an authorized EURC trustline and at least ${requiredEurc} EURC.`);
  if (!(Number(xlm?.balance) > 0)) throw new Error(`STOP: ${address} needs Testnet XLM.`);
  return { address, eurc: eurc.balance, xlm: xlm.balance };
}

export function units(value) {
  if (!/^\d+(\.\d{1,7})?$/.test(String(value))) throw new Error('Amount must be a nonnegative decimal with at most seven places');
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 10000000n + BigInt(fraction.padEnd(7, '0'));
}
export function decimal(value) {
  const n = BigInt(value);
  const magnitude = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}${magnitude / 10000000n}.${(magnitude % 10000000n).toString().padStart(7, '0')}`;
}

export function decodeEvent(event) {
  const topics = event.topic.map(t => scValToNative(xdr.ScVal.fromXDR(t, 'base64')));
  const data = scValToNative(xdr.ScVal.fromXDR(event.value, 'base64'));
  return { id: event.id, txHash: event.txHash, contractId: event.contractId, topics, data };
}

export function analyzeTransfers(events, contractId, expected) {
  const transfers = events.filter(e => e.contractId === TOKEN && e.topics[0] === 'transfer').map(e => ({
    from: e.topics[1], to: e.topics[2], units: BigInt(e.data), eventId: e.id,
  }));
  if (expected.action === 'fund') {
    const matched = transfers.filter(t => t.from === expected.signer && t.to === contractId);
    const received = matched.reduce((n, t) => n + t.units, 0n);
    if (received !== units(expected.amount)) throw new Error('Funding amount/payer/escrow mismatch in token transfer events');
    return { independentlyVerified: true, payer: expected.signer, escrow: contractId, received: decimal(received), transfers };
  }
  if (expected.action === 'resolve-dispute') {
    const outgoing = transfers.filter(t => t.from === contractId);
    const total = outgoing.reduce((n, t) => n + t.units, 0n);
    const gross = expected.distributions.reduce((n, d) => n + units(d.amount), 0n);
    if (total !== gross) throw new Error('Settlement outgoing transfers do not equal gross distribution total');
    const recipients = expected.distributions.map(d => {
      const net = outgoing.filter(t => t.to === d.address).reduce((n, t) => n + t.units, 0n);
      return { address: d.address, gross: String(d.amount), net: decimal(net), deduction: decimal(units(d.amount) - net) };
    });
    const known = new Set(expected.distributions.map(d => d.address));
    const otherTransfers = outgoing.filter(t => !known.has(t.to));
    const fees = otherTransfers.reduce((n, t) => n + t.units, 0n);
    return { independentlyVerified: true, gross: decimal(gross), recipients, feeTransfers: otherTransfers, totalFee: decimal(fees), effectiveFeeBps: gross ? Number(fees * 1000000n / gross) / 100 : null, transfers };
  }
  return { independentlyVerified: true, transfers };
}

export async function verifyTransaction(hash, intent) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid transaction hash');
  const tx = await rpcCall('getTransaction', { hash });
  if (tx.status !== 'SUCCESS') throw new Error(`Transaction is ${tx.status}; do not rebuild or resubmit. Reconcile this hash first.`);
  const envelope = TransactionBuilder.fromXDR(tx.envelopeXdr, NETWORK);
  if (envelope.hash().toString('hex') !== hash || envelope.source !== intent.signer) throw new Error('Transaction hash/source mismatch');
  const events = [];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const result = await rpcCall('getEvents', {
      ...(cursor ? {} : { startLedger: tx.ledger }),
      filters: [{ type: 'contract', contractIds: [TOKEN] }],
      pagination: { limit: 1000, ...(cursor ? { cursor } : {}) },
    });
    events.push(...result.events.filter(e => e.txHash === hash && e.inSuccessfulContractCall !== false).map(decodeEvent));
    if (result.events.length < 1000 || result.events.some(e => e.ledger > tx.ledger)) break;
    const next = result.cursor ?? result.events.at(-1)?.pagingToken;
    if (!next || next === cursor || page === 19) throw new Error('Incomplete transfer event pagination');
    cursor = next;
  }
  const analysis = analyzeTransfers(events, intent.contractId, intent);
  const charged = xdr.TransactionResult.fromXDR(tx.resultXdr, 'base64').feeCharged().toString();
  return { hash, ledger: tx.ledger, status: tx.status, verifiedAt: new Date().toISOString(), networkFeeXlm: decimal(charged), events, analysis, raw: tx };
}
