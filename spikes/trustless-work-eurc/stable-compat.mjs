// Isolated V1 build-only probe. No signing, submission, app or database access.
import { TransactionBuilder, scValToNative } from '@stellar/stellar-sdk';
import { apiKey, wallets, record, NETWORK, ISSUER, SYMBOL, TOKEN } from './config.mjs';
import { verifyAsset, accountReadiness } from './stellar.mjs';

const base = 'https://dev.api.trustlesswork.com';
const path = '/deployer/single-release';
const key = await apiKey();
try {
  const w = await wallets();
  const asset = await verifyAsset();
  await accountReadiness(w.organizer);
  const payload = {
    signer: w.admin,
    engagementId: 'gamelock-stable-compat-2026-10-26',
    title: 'GameLock isolated V1 Testnet compatibility',
    description: 'One test game; two depositor-only players, 7 EURC each. Unsigned preparation only.',
    roles: { approver: w.operations, serviceProvider: w.organizer,
      platformAddress: w.admin, releaseSigner: w.operations,
      disputeResolver: w.resolver, receiver: w.organizer },
    amount: 14, platformFee: 0,
    milestones: [{ description: 'Test game settlement' }],
    trustline: { address: ISSUER, symbol: SYMBOL },
  };
  const response = await fetch(base + path, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  if (raw.includes(key)) throw new Error('Refusing credential-bearing response');
  let data; try { data = JSON.parse(raw); } catch { data = { nonJsonResponse: true }; }
  const result = { at: new Date().toISOString(), base, path, httpStatus: response.status,
    asset, payload, response: data, signed: false, submitted: false };
  if (response.ok && typeof data.unsignedTransaction === 'string') {
    const tx = TransactionBuilder.fromXDR(data.unsignedTransaction, NETWORK);
    if (tx.source !== w.admin || tx.signatures.length !== 0) throw new Error('Unexpected source or signatures');
    result.inspection = { source: tx.source, feeStroops: tx.fee, sequence: tx.sequence,
      signatures: tx.signatures.length, timeBounds: tx.timeBounds,
      operations: tx.operations.map(op => {
        const out = { type: op.type, source: op.source };
        if (op.func) {
          out.hostFunction = op.func.switch().name;
          if (out.hostFunction === 'hostFunctionTypeInvokeContract') {
            const invoke = op.func.invokeContract();
            out.function = invoke.functionName().toString();
            out.arguments = invoke.args().map(scValToNative);
          }
        }
        return out;
      }) };
    result.status = 'unsigned_prepared_STOP_before_signing';
  } else result.status = 'no_unsigned_deployment';
  console.log(await record('stable-v1-compat', result));
  console.log(JSON.stringify({ ...result, response: { ...data, unsignedTransaction: data.unsignedTransaction ? '[saved locally; unsigned]' : undefined } }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
} catch (e) {
  console.error(String(e.message).split(key).join('[REDACTED]'));
  process.exitCode = 1;
}
