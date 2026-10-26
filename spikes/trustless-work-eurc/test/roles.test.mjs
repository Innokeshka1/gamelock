import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWalletRoles } from '../config.mjs';

// Synthetic labels test authority composition, not Stellar address encoding.
const addressValidator = { isValidEd25519PublicKey: value => typeof value === 'string' && value.length > 0 };
const base = { admin: 'admin', operations: 'organizer', platform: 'organizer', organizer: 'organizer', resolver: 'resolver', playerA: 'player-a', playerB: 'player-b' };
test('permits organizer/operator overlap with separate admin, resolver and depositors', () => {
  assert.deepEqual(validateWalletRoles(base, addressValidator), base);
});
test('neither player can hold any escrow authority, including dispute roles', () => {
  for (const player of ['playerA', 'playerB']) {
    for (const role of ['admin', 'operations', 'resolver', 'platform', 'organizer']) {
      assert.throws(() => validateWalletRoles({ ...base, [role]: base[player] }, addressValidator), /depositors only/);
    }
  }
});
test('missing admin or resolver blocks deployment instead of assigning a player', () => {
  for (const role of ['admin', 'resolver']) assert.throws(() => validateWalletRoles({ ...base, [role]: '' }, addressValidator), /missing\/invalid/);
});
