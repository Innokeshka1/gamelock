// Read-only Testnet role-account inspection. Does not call deployment or require signing.
import { wallets, HORIZON, ISSUER, SYMBOL, record } from './config.mjs';
import { json, units, decimal } from './stellar.mjs';

const w = await wallets();
const latest = (await json(`${HORIZON}/ledgers?order=desc&limit=1`))._embedded.records[0];
const reserve = BigInt(latest.base_reserve_in_stroops);
const checks = await Promise.all(['admin', 'resolver'].map(async role => {
  const a = await json(`${HORIZON}/accounts/${w[role]}`);
  const native = a.balances.find(b => b.asset_type === 'native');
  const minBalance = BigInt(2 + a.subentry_count + (a.num_sponsoring ?? 0) - (a.num_sponsored ?? 0)) * reserve;
  const available = units(native.balance) - minBalance - units(native.selling_liabilities ?? '0');
  return { role, address: w[role], exists: true, balanceXlm: native.balance, minimumReserveXlm: decimal(minBalance), sellingLiabilitiesXlm: native.selling_liabilities ?? '0', spendableXlm: decimal(available), eurcTrustlinePresent: a.balances.some(b => b.asset_code === SYMBOL && b.asset_issuer === ISSUER), accountLastModifiedLedger: a.last_modified_ledger };
}));
const result = { checkedAt: new Date().toISOString(), network: 'Stellar Testnet', reserveLedger: latest.sequence, baseReserveXlm: decimal(reserve), checks, caveat: 'Exact Soroban transaction fee sufficiency must be confirmed by simulation when deployment is unblocked. No deployment attempted.' };
await record('role-account-readiness', result);
console.log(JSON.stringify(result, null, 2));
