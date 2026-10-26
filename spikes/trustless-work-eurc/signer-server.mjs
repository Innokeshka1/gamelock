import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { TransactionBuilder, Keypair } from '@stellar/stellar-sdk';
import { ROOT, NETWORK, artifact, record, tw } from './config.mjs';

const name = process.argv[2];
const prepared = await artifact(name);
if (prepared.network !== NETWORK) throw new Error('Testnet only');
// One process handles exactly one prepared intent. No generic transaction proxy.
const token = randomBytes(32).toString('hex');
const host = '127.0.0.1:4318';
const origin = `http://${host}`;
const bundle = await build({ entryPoints: [resolve(ROOT, 'signer.client.mjs')], bundle: true, write: false, platform: 'browser', format: 'esm' });
let attempted = false;
try { await artifact(`${name}-submission`); attempted = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
const htmlEscape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const context = { signer: prepared.intent.signer, network: NETWORK, unsignedXdr: prepared.unsignedXdr, token };
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403).end(); return; }
  if (req.method === 'GET' && req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><meta charset="utf-8"><title>GameLock isolated Testnet spike</title><h1>Trustless Work V2 beta — TESTNET ONLY</h1><p>Review this intent and the wallet transaction before signing. This is not the GameLock application.</p><pre>${htmlEscape(JSON.stringify({ intent: prepared.intent, payload: prepared.payload, txHash: prepared.txHash }, null, 2))}</pre><button ${attempted ? 'disabled' : ''}>Connect Freighter, sign and submit this transaction</button><pre id="result">${attempted ? 'Submission already attempted. Run CLI verify; do not retry blindly.' : ''}</pre><script type="application/json" id="context">${JSON.stringify(context).replaceAll('<', '\\u003c')}</script><script type="module" src="/signer.js"></script>`);
    return;
  }
  if (req.method === 'GET' && req.url === '/signer.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return; }
  if (req.method !== 'POST' || req.url !== '/submit' || req.headers.origin !== origin || req.headers['x-spike-token'] !== token) { res.writeHead(403).end(); return; }
  res.setHeader('Content-Type', 'application/json');
  try {
    if (attempted) throw new Error('Submission already attempted');
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 1000000) throw new Error('Request too large'); }
    const { signedXdr } = JSON.parse(body);
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
    if (tx.hash().toString('hex') !== prepared.txHash || tx.source !== prepared.intent.signer) throw new Error('Signed transaction differs from prepared intent');
    const signer = Keypair.fromPublicKey(prepared.intent.signer);
    if (!tx.signatures.some(s => signer.verify(tx.hash(), s.signature()))) throw new Error('Required wallet signature absent');
    attempted = true;
    // Persist intent before submission. On timeout, reconciliation is mandatory.
    await record(`${name}-submission`, { txHash: prepared.txHash, status: 'submission_attempted', at: new Date().toISOString() });
    const result = await tw('/stellar/send-transaction', { signedXdr });
    if (result.txHash !== prepared.txHash) throw new Error('Submission hash mismatch');
    await record(`${name}-submission`, { txHash: result.txHash, ledger: result.ledger, code: result.code ?? null, contractId: result.contractId ?? null, status: 'api_reported_submitted_chain_verification_required' });
    res.end(JSON.stringify({ txHash: result.txHash, next: `Run: node cli.mjs verify ${name}. API acceptance alone is not a verified payment.` }));
  } catch {
    // Avoid exposing network error objects or the server's API key to the browser.
    res.writeHead(400).end(JSON.stringify({ error: 'Signing/submission could not be completed. If submission was attempted, reconcile the prepared transaction hash before retrying.', txHash: prepared.txHash }));
  }
});
server.listen(4318, '127.0.0.1', () => console.log(`Open ${origin} and sign with ${prepared.intent.signer}. API key stays server-side.`));
