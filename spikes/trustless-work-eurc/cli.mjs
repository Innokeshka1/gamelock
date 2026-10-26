import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { ROOT, API, PREFIX, NETWORK, TOKEN, tw, record, artifact, wallets } from './config.mjs';
import { verifyAsset, accountReadiness, readToken, units, decimal, verifyTransaction } from './stellar.mjs';

const [command, name, ...args] = process.argv.slice(2);
try {
  if (command === 'preflight') {
    const asset = await verifyAsset();
    await record('asset', asset);
    console.log(JSON.stringify(asset, null, 2));
    // Deliberately do not print account-wide escrow data.
    await tw('/escrows?limit=1');
    const result = { at: new Date().toISOString(), apiHost: API, endpoint: 'GET /escrows?limit=1', authenticatedRead: true, asset, signing: 'not attempted' };
    await record('preflight', result);
    console.log('Authenticated beta API read succeeded. No transaction built or submitted.');
  } else if (command === 'wallets') {
    const w = await wallets();
    const checks = [];
    for (const role of ['organizer', 'playerA', 'playerB']) checks.push({ role, ...await accountReadiness(w[role], role.startsWith('player') ? 14 : 0) });
    // Non-receiving role accounts still need to exist to sign and pay XLM fees.
    const { json } = await import('./stellar.mjs');
    const { HORIZON } = await import('./config.mjs');
    for (const role of ['admin', 'operations', 'resolver', 'platform']) await json(`${HORIZON}/accounts/${w[role]}`);
    await record('wallet-readiness', checks);
    console.log('Public wallet accounts and player/organizer EURC readiness checked.');
  } else if (command === 'prepare') {
    // prepare <name> <deploy|fund|dispute|resolve-dispute> ...
    const [action, ...values] = args;
    const preflight = await artifact('preflight');
    if (!preflight.authenticatedRead || preflight.asset.token !== TOKEN) throw new Error('Run successful preflight first');
    const w = await wallets();
    let payload;
    let intent;
    if (action === 'deploy') {
      await accountReadiness(w.organizer);
      payload = {
        signer: w.admin, engagementId: `gamelock-spike-${name}-${Date.now()}`,
        title: 'GameLock hackathon compatibility spike', description: 'V2 BETA / TESTNET ONLY. Two players, 7 EURC each. No production bookings.',
        roles: { admin: w.admin, approvers: [w.operations], releaseSigners: [w.operations], serviceProviders: [w.organizer], disputeResolvers: [w.resolver], platform: w.platform, receiver: w.organizer, observers: [] },
        amount: 14, platformFee: 0, trustline: { contractId: TOKEN },
        milestones: [{ description: 'Test game settlement', approvalsTarget: 1 }],
      };
      intent = { action, signer: w.admin };
    } else {
      const [contractId, roleOrFile, amount] = values;
      const { StrKey } = await import('@stellar/stellar-sdk');
      if (!StrKey.isValidContract(contractId ?? '')) throw new Error('Supply the confirmed escrow contract ID');
      // Never operate on a contract without this harness's verified deployment receipt.
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(resolve(ROOT, 'artifacts'));
      const receipts = await Promise.all(files.filter(f => f.endsWith('-verified.json')).map(f => readFile(resolve(ROOT, 'artifacts', f), 'utf8').then(JSON.parse)));
      if (!receipts.some(r => r.intent?.action === 'deploy' && r.intent.contractId === contractId && r.verification?.status === 'SUCCESS')) throw new Error('No verified spike deployment for this contract');
      const escrow = await tw(`${PREFIX}/${contractId}`);
      await record(`${name}-escrow-before`, escrow);
      if (action === 'fund') {
        if (!['playerA', 'playerB', 'organizer'].includes(roleOrFile)) throw new Error('Funder role must be playerA, playerB, or organizer (subsidy)');
        const n = units(amount);
        if (n <= 0n || n > units('100')) throw new Error('Spike funding must be > 0 and <= 100 EURC');
        await accountReadiness(w[roleOrFile], Number(amount));
        payload = { contractId, signer: w[roleOrFile], amount: Number(amount) };
        intent = { action, contractId, signer: payload.signer, amount: String(amount) };
      } else if (action === 'dispute') {
        payload = { contractId, signer: w.operations, reason: 'GameLock hackathon settlement/refund compatibility test' };
        intent = { action, contractId, signer: w.operations };
      } else if (action === 'resolve-dispute') {
        const distributions = JSON.parse(await readFile(resolve(roleOrFile), 'utf8'));
        if (!Array.isArray(distributions) || distributions.length < 1 || distributions.length > 50) throw new Error('Supply 1–50 distributions');
        if (new Set(distributions.map(d => d.address)).size !== distributions.length) throw new Error('Aggregate each recipient into one distribution');
        const allowed = new Set([w.playerA, w.playerB, w.organizer]);
        let total = 0n;
        for (const d of distributions) {
          if (!allowed.has(d.address) || units(d.amount) <= 0n) throw new Error('Invalid recipient or nonpositive allocation');
          total += units(d.amount);
          await accountReadiness(d.address);
        }
        const balance = BigInt(await readToken('balance', contractId));
        if (total !== balance) throw new Error(`Gross allocations must equal current balance ${decimal(balance)} EURC`);
        payload = { contractId, disputeResolver: w.resolver, distributions: distributions.map(d => ({ address: d.address, amount: Number(d.amount) })) };
        intent = { action, contractId, signer: w.resolver, distributions, balanceBefore: balance.toString() };
      } else throw new Error('Unsupported action');
    }
    // Refuse accidental overwrite/rebuild of an existing transaction intent.
    try { await artifact(name); throw new Error('Intent already exists; reconcile it or choose a fresh artifact name'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const build = await tw(`${PREFIX}/${action}`, payload);
    if (typeof build.unsignedXdr !== 'string') throw new Error('API inconsistency: expected unsignedXdr');
    const tx = TransactionBuilder.fromXDR(build.unsignedXdr, NETWORK);
    if (tx.source !== intent.signer) throw new Error('Unexpected transaction source');
    const txHash = tx.hash().toString('hex');
    if (build.txHash !== txHash) throw new Error('API hash does not match XDR on Testnet');
    if (action === 'deploy') {
      const { StrKey } = await import('@stellar/stellar-sdk');
      if (!StrKey.isValidContract(build.contractId ?? '')) throw new Error('Deploy response missing predicted contractId');
      intent.contractId = build.contractId;
    }
    const prepared = { createdAt: new Date().toISOString(), network: NETWORK, endpoint: `${PREFIX}/${action}`, intent, payload, unsignedXdr: build.unsignedXdr, txHash, status: 'awaiting_manual_signature' };
    console.log(await record(name, prepared));
    console.log(`STOP: run node signer-server.mjs ${name}, review the intent, and sign using ${intent.signer}.`);
  } else if (command === 'verify') {
    const prepared = await artifact(name);
    const verification = await verifyTransaction(prepared.txHash, prepared.intent);
    if (prepared.intent.action === 'deploy') {
      const escrow = await tw(`${PREFIX}/${prepared.intent.contractId}`);
      await record(`${name}-escrow`, escrow);
    }
    await record(`${name}-verified`, { intent: prepared.intent, verification });
    console.log(JSON.stringify({ hash: verification.hash, ledger: verification.ledger, networkFeeXlm: verification.networkFeeXlm, analysis: verification.analysis }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } else {
    console.log('Commands: preflight | wallets | prepare NAME deploy | prepare NAME fund CONTRACT playerA|playerB|organizer AMOUNT | prepare NAME dispute CONTRACT | prepare NAME resolve-dispute CONTRACT DISTRIBUTIONS_JSON | verify NAME');
    process.exitCode = 1;
  }
} catch (e) {
  // Do not dump stack/request objects from network libraries.
  const { apiKey } = await import('./config.mjs');
  const key = await apiKey().catch(() => '');
  const message = String(e.message ?? 'Spike failed');
  console.error(key ? message.split(key).join('[REDACTED]') : message);
  process.exitCode = 1;
}
