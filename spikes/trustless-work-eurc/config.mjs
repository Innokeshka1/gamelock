import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('.', import.meta.url));
export const API = 'https://beta.api.trustlesswork.com';
export const RPC = 'https://soroban-testnet.stellar.org';
export const HORIZON = 'https://horizon-testnet.stellar.org';
export const NETWORK = 'Test SDF Network ; September 2015';
export const TOKEN = 'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ';
export const ISSUER = 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO';
export const SYMBOL = 'EURC';
export const PREFIX = '/escrow/single-release/v2';

// Never load the root application's other secrets into this spike.
export async function apiKey() {
  if (process.env.TRUSTLESS_WORK_API_KEY) return process.env.TRUSTLESS_WORK_API_KEY;
  const { parseEnv } = await import('node:util');
  const env = parseEnv(await readFile(resolve(ROOT, '../../.env'), 'utf8'));
  if (!env.TRUSTLESS_WORK_API_KEY) throw new Error('STOP: TRUSTLESS_WORK_API_KEY is missing from the repository .env.');
  return env.TRUSTLESS_WORK_API_KEY;
}

export async function record(name, data) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid artifact name');
  await mkdir(resolve(ROOT, 'artifacts'), { recursive: true });
  const path = resolve(ROOT, 'artifacts', `${name}.json`);
  const value = JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
  // Prevent credential persistence even if an upstream response unexpectedly echoes it.
  const key = await apiKey().catch(() => '');
  if (key && value.includes(key)) throw new Error('Refusing to persist a credential-bearing response');
  await writeFile(path, value + '\n', { mode: 0o600 });
  return path;
}

export async function artifact(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid artifact name');
  return JSON.parse(await readFile(resolve(ROOT, 'artifacts', `${name}.json`), 'utf8'));
}

export async function tw(path, body) {
  if (!(path === '/escrows?limit=1' || path === '/stellar/send-transaction' || path.startsWith(PREFIX + '/'))) throw new Error('Unapproved API path');
  const response = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-api-key': await apiKey(), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  const data = await response.json().catch(() => ({}));
  // Do not return unfiltered upstream error text, request headers, or credentials.
  if (!response.ok) {
    const code = typeof data.code === 'string' && /^[A-Z0-9_]+$/.test(data.code) ? data.code : 'UNCLASSIFIED';
    if (code === 'ESCROW_RECEIVER_TRUSTLINE_MISSING') {
      await record('deploy-trustline-error', { status: response.status, code, path, extensions: data.extensions ?? null, at: new Date().toISOString() });
    }
    throw new Error(`Trustless Work ${response.status} ${code} at ${path}`);
  }
  return data;
}

export function validateWalletRoles(data, StrKey) {
  const names = ['admin', 'operations', 'resolver', 'platform', 'organizer', 'playerA', 'playerB'];
  for (const name of names) if (!StrKey.isValidEd25519PublicKey(data[name] ?? '')) throw new Error(`STOP: missing/invalid public wallet address: ${name}`);
  if (data.playerA === data.playerB) throw new Error('The two depositors must use different wallets');
  const authorities = ['admin', 'operations', 'resolver', 'platform', 'organizer'];
  for (const player of ['playerA', 'playerB']) {
    if (authorities.some(role => data[role] === data[player])) throw new Error('Players are depositors only and cannot hold any escrow role');
  }
  const operational = [data.operations, data.platform, data.organizer];
  if (data.admin === data.resolver || operational.includes(data.admin) || operational.includes(data.resolver)) throw new Error('Admin and resolver must be separate from one another and all operational roles');
  return Object.fromEntries(names.map(n => [n, data[n]]));
}

export async function wallets() {
  let data;
  try { data = JSON.parse(await readFile(resolve(ROOT, 'wallets.json'), 'utf8')); }
  catch { throw new Error('STOP: copy wallets.example.json to wallets.json and supply public Testnet wallet addresses. Never supply secret keys.'); }
  const { StrKey } = await import('@stellar/stellar-sdk');
  return validateWalletRoles(data, StrKey);
}
