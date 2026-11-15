// The donor pool on Solana (devnet). Donor money sits in the relief_pool program
// and can only leave when an evacuation order is on-chain, within the $770
// household cap, to the county's relief account. Each release carries the
// Nessie transaction that paid the family, so the path is auditable end to end.
// Set up with scripts/solana-setup.ts, which writes data/solana-state.json.

import "server-only";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { AnchorProvider, BN, Program, Wallet, type Idl } from "@anchor-lang/core";
import { createAssociatedTokenAccountIdempotent, getAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import idl from "@/data/relief_pool.idl.json";
import { logActivity } from "../activity";

const STATE_FILE = "data/solana-state.json";
const DECIMALS = 6;
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

type SolState = {
  programId: string;
  mint: string;
  countyPayout: string;
  pool: string;
  vault: string;
  donors: string[];
  incident: string;
  zone: string;
  run?: number;
};

function loadState(): SolState | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as SolState;
}

function loadCounty(): Keypair | null {
  const path = (process.env.SOLANA_KEYPAIR_PATH || "~/.config/evacuaid/solana-devnet-keypair.json").replace("~", homedir());
  if (!existsSync(path)) return null;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

type Ctx = { s: SolState; county: Keypair; connection: Connection; program: Program };
const g = globalThis as unknown as { __evacuaidSolana?: Ctx | null; __evacuaidSolanaSnap?: { at: number; snap: PoolSnapshot } };

function ctx(): Ctx | null {
  if (g.__evacuaidSolana !== undefined) return g.__evacuaidSolana;
  const s = loadState();
  const county = loadCounty();
  if (!s || !county) return (g.__evacuaidSolana = null);
  const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const program = new Program(idl as Idl, new AnchorProvider(connection, new Wallet(county), { commitment: "confirmed" }));
  return (g.__evacuaidSolana = { s, county, connection, program });
}

export const solanaConfigured = () => ctx() !== null;

const pda = (programId: PublicKey, ...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
/** Households appear on-chain only as a hash, never a name or address. Salted per drill run. */
export const householdHash = (householdId: string) =>
  createHash("sha256")
    .update(`evacuaid:${ctx()?.s.run ?? 0}:${householdId}`)
    .digest();

/** Start a new drill run: new household hashes, so on-chain caps start fresh. The pool keeps its money. */
export function newRun() {
  const c = ctx();
  if (!c) return;
  c.s.run = (c.s.run ?? 0) + 1;
  writeFileSync(STATE_FILE, JSON.stringify(c.s, null, 2));
  g.__evacuaidSolanaSnap = undefined;
}
const centsToUnits = (cents: number) => new BN(cents).mul(new BN(10 ** (DECIMALS - 2)));

export type PoolSnapshot = {
  programId: string;
  pool: string;
  incident: string;
  zone: string;
  donors: number;
  donatedCents: number;
  releasedCents: number;
  vaultCents: number;
  releases: number;
  capCents: number;
  orderPublished: boolean;
  recent: { sig: string; at: number | null }[];
};

/** Live pool numbers from the chain (cached 10 s; devnet's public RPC rate-limits). */
export async function poolSnapshot(): Promise<PoolSnapshot | null> {
  const c = ctx();
  if (!c) return null;
  const cached = g.__evacuaidSolanaSnap;
  if (cached && Date.now() - cached.at < 10_000) return cached.snap;
  const programId = c.program.programId;
  const poolKey = new PublicKey(c.s.pool);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = await (c.program.account as any).pool.fetch(poolKey);
  const vault = await getAccount(c.connection, new PublicKey(c.s.vault));
  const zone = pda(programId, Buffer.from("zone"), poolKey.toBuffer(), Buffer.from(c.s.zone));
  const [zoneInfo, sigs] = await Promise.all([
    c.connection.getAccountInfo(zone),
    c.connection.getSignaturesForAddress(poolKey, { limit: 8 }),
  ]);
  const toCents = (units: bigint | BN) => Number(BigInt(units.toString()) / BigInt(10 ** (DECIMALS - 2)));
  const snap: PoolSnapshot = {
    programId: programId.toBase58(),
    pool: c.s.pool,
    incident: c.s.incident,
    zone: c.s.zone,
    donors: c.s.donors.length + donations().length,
    donatedCents: toCents(p.totalDonated),
    releasedCents: toCents(p.totalReleased),
    vaultCents: toCents(vault.amount),
    releases: Number(p.releases.toString()),
    capCents: toCents(p.capPerHousehold),
    orderPublished: Boolean(zoneInfo),
    recent: sigs.filter((x) => !x.err).map((x) => ({ sig: x.signature, at: x.blockTime ? x.blockTime * 1000 : null })),
  };
  g.__evacuaidSolanaSnap = { at: Date.now(), snap };
  return snap;
}

/** Publish the evacuation order for the incident zone on-chain (no-op if it's already there). */
export async function ensureOrder(): Promise<string | null> {
  const c = ctx();
  if (!c) return null;
  const poolKey = new PublicKey(c.s.pool);
  const zoneAccount = pda(c.program.programId, Buffer.from("zone"), poolKey.toBuffer(), Buffer.from(c.s.zone));
  if (await c.connection.getAccountInfo(zoneAccount)) return null;
  return c.program.methods
    .publishOrder(c.s.zone)
    .accounts({ authority: c.county.publicKey, pool: poolKey, zoneAccount, systemProgram: SystemProgram.programId })
    .rpc();
}

/**
 * Release donor money for one approved payment. The program enforces the order,
 * the cap and the payout account; we pass the Nessie transaction for the audit trail.
 */
export async function releaseFor(householdId: string, amountCents: number, nessieTx: string): Promise<{ sig?: string; error?: string }> {
  const c = ctx();
  if (!c) return { error: "Solana pool not set up" };
  const poolKey = new PublicKey(c.s.pool);
  const programId = c.program.programId;
  const hh = householdHash(householdId);
  try {
    const sig = await c.program.methods
      .release([...hh], c.s.zone, centsToUnits(amountCents), nessieTx.slice(0, 64))
      .accounts({
        authority: c.county.publicKey,
        pool: poolKey,
        zoneAccount: pda(programId, Buffer.from("zone"), poolKey.toBuffer(), Buffer.from(c.s.zone)),
        claim: pda(programId, Buffer.from("claim"), poolKey.toBuffer(), hh),
        mint: new PublicKey(c.s.mint),
        vault: new PublicKey(c.s.vault),
        countyPayout: new PublicKey(c.s.countyPayout),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    g.__evacuaidSolanaSnap = undefined; // refresh numbers on next read
    return { sig };
  } catch (e) {
    const err = (e as { error?: { errorMessage?: string } }).error;
    return { error: err?.errorMessage ?? (e as Error).message.split("\n")[0] };
  }
}

// ---- public donations (devnet test money, real transactions) ----------------

const DONOR_FILE = "data/solana-donor.json";
const DONATIONS_FILE = "data/solana-donations.json";

export type Donation = { id: string; at: number; cents: number; name: string; sig: string };

const gd = globalThis as unknown as { __evacuaidDonations?: Donation[] };
export function donations(): Donation[] {
  if (!gd.__evacuaidDonations) {
    gd.__evacuaidDonations = existsSync(DONATIONS_FILE) ? (JSON.parse(readFileSync(DONATIONS_FILE, "utf8")) as Donation[]) : [];
  }
  return gd.__evacuaidDonations;
}

/** One demo donor wallet signs public gifts (visitors don't need a wallet on devnet). */
async function demoDonor(c: Ctx): Promise<Keypair> {
  let donor: Keypair;
  if (existsSync(DONOR_FILE)) donor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(DONOR_FILE, "utf8"))));
  else {
    donor = Keypair.generate();
    writeFileSync(DONOR_FILE, JSON.stringify([...donor.secretKey]));
  }
  if ((await c.connection.getBalance(donor.publicKey)) < 0.01 * LAMPORTS_PER_SOL) {
    await sendAndConfirmTransaction(
      c.connection,
      new Transaction().add(SystemProgram.transfer({ fromPubkey: c.county.publicKey, toPubkey: donor.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL })),
      [c.county],
    );
  }
  return donor;
}

/** A public gift: test dollars minted to the demo donor, then given through the program's donate(). */
export async function donate(cents: number, name: string): Promise<Donation> {
  const c = ctx();
  if (!c) throw new Error("The pool isn't connected on this server");
  const donor = await demoDonor(c);
  const mint = new PublicKey(c.s.mint);
  const donorTokens = await createAssociatedTokenAccountIdempotent(c.connection, c.county, mint, donor.publicKey);
  const units = centsToUnits(cents);
  await mintTo(c.connection, c.county, mint, donorTokens, c.county, BigInt(units.toString()));
  const sig = await c.program.methods
    .donate(units)
    .accounts({
      donor: donor.publicKey,
      pool: new PublicKey(c.s.pool),
      mint,
      donorTokens,
      vault: new PublicKey(c.s.vault),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([donor])
    .rpc();
  const d: Donation = { id: sig.slice(0, 16), at: Date.now(), cents, name: name || "Anonymous", sig };
  logActivity({ system: "solana", what: "Gift into the donor pool", detail: `${d.name} · program donate()`, cents, tone: "ok", ref: sig, link: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
  donations().push(d);
  writeFileSync(DONATIONS_FILE, JSON.stringify(donations(), null, 2));
  g.__evacuaidSolanaSnap = undefined;
  return d;
}
