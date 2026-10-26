import test from 'node:test';
import assert from 'node:assert/strict';
import { units, decimal, analyzeTransfers } from '../stellar.mjs';
import { TOKEN } from '../config.mjs';

const event = (from, to, amount, contractId = TOKEN) => ({ contractId, topics: ['transfer', from, to], data: units(amount), id: `${from}-${to}` });
test('exact seven-decimal conversion and invalid amount rejection', () => {
  for (const n of ['0', '7', '5.6', '0.0000001', '14.0421264']) assert.equal(units(decimal(units(n))), units(n));
  for (const n of ['NaN', '-7', '1e2', '0.00000001']) assert.throws(() => units(n));
  assert.equal(decimal(-1n), '-0.0000001');
});
test('deposit is tied to payer, token, amount and escrow', () => {
  const intent = { action: 'fund', signer: 'A', amount: '7' };
  assert.equal(analyzeTransfers([event('A', 'escrow', '7')], 'escrow', intent).received, '7.0000000');
  for (const events of [[event('B', 'escrow', '7')], [event('A', 'other', '7')], [event('A', 'escrow', '7', 'wrong-token')], [event('A', 'escrow', '6')]]) assert.throws(() => analyzeTransfers(events, 'escrow', intent));
});
test('80% gross allocation measures actual deductions instead of claiming 80% net', () => {
  const result = analyzeTransfers([
    event('escrow', 'A', '5.5832'), event('escrow', 'organizer', '8.3748'), event('escrow', 'protocol', '0.042'),
  ], 'escrow', { action: 'resolve-dispute', distributions: [{ address: 'A', amount: '5.6' }, { address: 'organizer', amount: '8.4' }] });
  assert.equal(result.totalFee, '0.0420000');
  assert.equal(result.effectiveFeeBps, 30);
  assert.equal(result.recipients[0].net, '5.5832000');
});
test('100% gross allocation does not imply 100% net', () => {
  const result = analyzeTransfers([event('escrow', 'A', '6.979'), event('escrow', 'B', '6.979'), event('escrow', 'protocol', '0.042')], 'escrow', { action: 'resolve-dispute', distributions: [{ address: 'A', amount: '7' }, { address: 'B', amount: '7' }] });
  assert.equal(result.recipients[0].deduction, '0.0210000');
});
test('incomplete settlement evidence cannot pass verification', () => {
  assert.throws(() => analyzeTransfers([event('escrow', 'A', '6.979')], 'escrow', { action: 'resolve-dispute', distributions: [{ address: 'A', amount: '7' }] }));
});
