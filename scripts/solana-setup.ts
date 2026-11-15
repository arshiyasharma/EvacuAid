// Set up the EvacuAid relief pool on devnet and prove its rules.
//   bun --env-file=.env.local scripts/solana-setup.ts
//
// Creates a test dollar token (6 decimals, stands in for USDC on devnet), the
// county's payout account, three donors who give, and the Eaton pool. Then it
// tries every rule: a release before any order (refused), the order, a $770
// release (paid), $1 more (refused by the cap), and paying anyone but the
// county (refused). Writes data/solana-state.json for the app.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { AnchorProvider, BN, Program, Wallet, type Idl } from "@anchor-lang/core";
import {
  createAssociatedTokenAccountIdempotent,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import idl from "../solana/target/idl/relief_pool.json";

const STATE = "data/solana-state.json";
const DECIMALS = 6;
const usd = (n: number) => new BN(Math.round(n * 10 ** DECIMALS));
const INCIDENT = "eaton-2025";
const ZONE = "west-altadena";
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const keyPath = (process.env.SOLANA_KEYPAIR_PATH || "~/.config/evacuaid/solana-devnet-keypair.json").replace("~", homedir());
const county = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, new Wallet(county), { commitment: "confirmed" });
const program = new Program(idl as Idl, provider);

type State = { mint?: string; countyPayout?: string; pool?: string; vault?: string; donors?: string[]; proofs?: Record<string, string> };
const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => {
  mkdirSync("data", { recursive: true });
  writeFileSync(STATE, JSON.stringify({ ...state, programId: program.programId.toBase58(), incident: INCIDENT, zone: ZONE }, null, 2));
};

const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const householdHash = (id: string) => createHash("sha256").update(`evacuaid:${id}`).digest();

async function expectRefusal(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`${label}: was NOT refused`);
  } catch (e) {
    const msg = (e as { error?: { errorMessage?: string; errorCode?: { code?: string } }; message?: string }).error;
    const why = msg?.errorMessage ?? msg?.errorCode?.code ?? (e as Error).message.split("\n")[0];
    if (why.includes("was NOT refused")) throw e;
    console.log(`  ✓ refused: ${label} → ${why}`);
  }
}

console.log(`program ${program.programId.toBase58()}`);
console.log(`county  ${county.publicKey.toBase58()} (${(await connection.getBalance(county.publicKey)) / LAMPORTS_PER_SOL} SOL)`);

// 1. Test dollar token and the county's payout account.
if (!state.mint) {
  const mint = await createMint(connection, county, county.publicKey, null, DECIMALS);
  state.mint = mint.toBase58();
  save();
}
const mint = new PublicKey(state.mint);
const countyPayout = await createAssociatedTokenAccountIdempotent(connection, county, mint, county.publicKey);
state.countyPayout = countyPayout.toBase58();

// 2. The pool.
const pool = pda(Buffer.from("pool"), county.publicKey.toBuffer(), Buffer.from(INCIDENT));
const vault = pda(Buffer.from("vault"), pool.toBuffer());
state.pool = pool.toBase58();
state.vault = vault.toBase58();
if (!(await connection.getAccountInfo(pool))) {
  const sig = await program.methods
    .initPool(INCIDENT, usd(770))
    .accounts({ authority: county.publicKey, pool, mint, vault, countyPayout, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`pool opened: ${explorer(sig)}`);
}
save();

// 3. Three donors give $25,000 / $15,000 / $10,000.
if (!state.donors?.length) {
  state.donors = [];
  for (const amount of [25_000, 15_000, 10_000]) {
    const donor = Keypair.generate();
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(SystemProgram.transfer({ fromPubkey: county.publicKey, toPubkey: donor.publicKey, lamports: 0.02 * LAMPORTS_PER_SOL })),
      [county],
    );
    const donorTokens = await createAssociatedTokenAccountIdempotent(connection, county, mint, donor.publicKey);
    await mintTo(connection, county, mint, donorTokens, county, BigInt(usd(amount).toString()));
    const sig = await program.methods
      .donate(usd(amount))
      .accounts({ donor: donor.publicKey, pool, mint, donorTokens, vault, tokenProgram: TOKEN_PROGRAM_ID })
      .signers([donor])
      .rpc();
    state.donors.push(donor.publicKey.toBase58());
    console.log(`donated $${amount.toLocaleString()}: ${explorer(sig)}`);
  }
  save();
}

// 4. Prove the rules with a test household.
const proofs: Record<string, string> = {};
const testHousehold = householdHash(`proof-${Date.now()}`);
const zoneAccount = pda(Buffer.from("zone"), pool.toBuffer(), Buffer.from(ZONE));
const claim = pda(Buffer.from("claim"), pool.toBuffer(), testHousehold);
const releaseAccounts = {
  authority: county.publicKey,
  pool,
  zoneAccount,
  claim,
  mint,
  vault,
  countyPayout,
  tokenProgram: TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
};
const release = (amount: number, accounts = releaseAccounts, zone = ZONE) =>
  program.methods.release([...testHousehold], zone, usd(amount), "proof-run").accounts(accounts).rpc();

console.log("\nrules:");
// ONLY=payout re-checks just the payout rule without spending more of the pool.
const payoutOnly = process.env.ONLY === "payout";
const zoneExists = Boolean(await connection.getAccountInfo(zoneAccount));
if (payoutOnly) {
  // skip to the payout check below
} else if (!zoneExists) {
  await expectRefusal("release before any evacuation order", () => release(770));
  const sig = await program.methods.publishOrder(ZONE).accounts({ authority: county.publicKey, pool, zoneAccount, systemProgram: SystemProgram.programId }).rpc();
  proofs.order = sig;
  console.log(`  ✓ order published for ${ZONE}: ${explorer(sig)}`);
} else {
  const otherZone = pda(Buffer.from("zone"), pool.toBuffer(), Buffer.from("pasadena-east"));
  await expectRefusal("release in a zone with no order", () => release(770, { ...releaseAccounts, zoneAccount: otherZone }, "pasadena-east"));
}

if (!payoutOnly) {
  proofs.release = await release(770);
  console.log(`  ✓ $770 released to the county relief account: ${explorer(proofs.release)}`);
  await expectRefusal("$1 more for the same household (cap is $770)", () => release(1));
}

// Same household and zone, valid in every way except where the money goes.
const stranger = Keypair.generate();
const strangerTokens = await createAssociatedTokenAccountIdempotent(connection, county, mint, stranger.publicKey);
await expectRefusal("paying anyone but the county", () => release(10, { ...releaseAccounts, countyPayout: strangerTokens }));

state.proofs = { ...state.proofs, ...proofs };
save();

const v = await getAccount(connection, vault);
const p = await getAccount(connection, getAssociatedTokenAddressSync(mint, county.publicKey));
console.log(`\npool vault: $${(Number(v.amount) / 10 ** DECIMALS).toLocaleString()} · county relief account: $${(Number(p.amount) / 10 ** DECIMALS).toLocaleString()}`);
console.log(`saved ${STATE}`);
