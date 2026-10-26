import "@tanstack/react-start/server-only";
import { z } from "zod";
import type { EscrowRoles, StellarTestnetConfig } from "./escrow-types";

type Environment = Record<string, string | undefined>;
const publicAccount = z.string().regex(/^G[A-Z2-7]{55}$/);
const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const schema = z.object({
  STELLAR_NETWORK: z.literal("testnet"),
  STELLAR_NETWORK_PASSPHRASE: z.literal("Test SDF Network ; September 2015"),
  STELLAR_RPC_URL: httpsUrl,
  STELLAR_HORIZON_URL: httpsUrl,
  EURC_SYMBOL: z.literal("EURC"),
  EURC_DECIMALS: z.literal("7"),
  EURC_ISSUER: publicAccount,
  EURC_CONTRACT_ID: z.string().regex(/^C[A-Z2-7]{55}$/),
  GAMELOCK_ADMIN_ADDRESS: publicAccount,
  GAMELOCK_OPERATOR_ADDRESS: publicAccount,
  GAMELOCK_RESOLVER_ADDRESS: publicAccount,
  GAMELOCK_PLATFORM_ADDRESS: publicAccount,
  TRUSTLESS_WORK_API_URL: z.literal("https://beta.api.trustlesswork.com"),
  TRUSTLESS_WORK_API_KEY: z.string().trim().min(1),
});

export interface TrustlessWorkServerConfig {
  stellar: StellarTestnetConfig;
  apiUrl: "https://beta.api.trustlesswork.com";
  /** Server-only credential: never include this object in server-function responses. */
  apiKey: string;
}

export function readTrustlessWorkConfig(env: Environment = process.env): TrustlessWorkServerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Field names only: never render supplied values or the API key in diagnostics.
    throw new Error(
      `Invalid Trustless Work configuration: ${[...new Set(parsed.error.issues.map((i) => i.path[0]))].join(", ")}`,
    );
  }
  const e = parsed.data;
  const roles = {
    admin: e.GAMELOCK_ADMIN_ADDRESS,
    operator: e.GAMELOCK_OPERATOR_ADDRESS,
    resolver: e.GAMELOCK_RESOLVER_ADDRESS,
    platform: e.GAMELOCK_PLATFORM_ADDRESS,
  };
  if (
    new Set([roles.admin, roles.resolver, roles.operator]).size !== 3 ||
    [roles.admin, roles.resolver].includes(roles.platform)
  )
    throw new Error("Admin and Resolver must be separate dedicated role accounts");
  return {
    apiUrl: e.TRUSTLESS_WORK_API_URL,
    apiKey: e.TRUSTLESS_WORK_API_KEY,
    stellar: {
      network: e.STELLAR_NETWORK,
      networkPassphrase: e.STELLAR_NETWORK_PASSPHRASE,
      rpcUrl: e.STELLAR_RPC_URL,
      horizonUrl: e.STELLAR_HORIZON_URL,
      asset: {
        symbol: e.EURC_SYMBOL,
        decimals: 7,
        issuer: e.EURC_ISSUER,
        contractId: e.EURC_CONTRACT_ID,
      },
      roles,
    },
  };
}

/** Address checks here are shape checks; SDK checksum and chain checks precede live deployment. */
export function assertDepositorOnly(roles: EscrowRoles, payerAddress: string): void {
  if (!publicAccount.safeParse(payerAddress).success)
    throw new Error("Invalid public depositor address");
  if (Object.values(roles).includes(payerAddress))
    throw new Error("Players must be depositors only; no escrow roles are permitted");
}

export function rolesForOrganizer(config: StellarTestnetConfig, organizer: string): EscrowRoles {
  if (!publicAccount.safeParse(organizer).success)
    throw new Error("Invalid public organizer address");
  if ([config.roles.admin, config.roles.resolver].includes(organizer))
    throw new Error("Organizer cannot be Admin or Resolver");
  return { ...config.roles, organizer };
}
