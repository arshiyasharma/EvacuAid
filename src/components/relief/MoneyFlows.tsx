"use client";

import { dollars, type MoneyState } from "@/components/console/useMoney";

/** Three pots of money, never mixed. Each says what it can and can't pay for. */
export function MoneyFlows({ money }: { money: MoneyState }) {
  const aidPaid = money.stipends.filter((s) => s.decision === "approved").reduce((a, s) => a + s.amountCents, 0);
  const fromDonors = money.stipends
    .filter((s) => s.decision === "approved" && s.funding?.source === "solana" && s.funding.status === "released")
    .reduce((a, s) => a + s.amountCents, 0);
  const bills = money.bills ?? [];
  const opsSpent = bills.reduce((a, b) => a + b.cents, 0);
  const pots = [
    {
      name: "Donor relief pool",
      where: "Solana · public",
      color: "#b9a8ff",
      left: money.pool?.vaultCents,
      pays: "Families: gas, rooms, food, medicine.",
      never: "Vans, staff, or more than $770 a home.",
      moved: `${dollars(fromDonors)} released to families tonight`,
    },
    {
      name: "County relief account",
      where: "Nessie · the bank side",
      color: "var(--color-out)",
      left: money.fund?.availableCents,
      pays: "Aid onto relief cards, after bank checks.",
      never: "Anything but evacuation. Unused money returns.",
      moved: `${dollars(aidPaid)} onto relief cards tonight`,
    },
    {
      name: "County Emergency Operations",
      where: "Nessie · county budget",
      color: "var(--color-silent)",
      left: money.ops?.availableCents,
      pays: "Vans, drivers, fuel, shelter.",
      never: "Residents. Rescue never waits on money.",
      moved: `${dollars(opsSpent)} on ${bills.length} rescue ${bills.length === 1 ? "trip" : "trips"} tonight`,
    },
  ];

  return (
    <section className="panel rounded-3xl p-6 sm:p-7">
      <h2 className="text-[30px] font-medium tracking-[-0.02em]">Three pots of money, never mixed.</h2>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {pots.map((p) => (
          <div key={p.name} className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[18px] font-medium">{p.name}</span>
            </div>
            <div className="mt-0.5 text-[13.5px] text-faint">{p.where}</div>
            <div className="mt-3 font-mono text-[36px] leading-none tabular-nums">{p.left === undefined ? "—" : dollars(p.left)}</div>
            <div className="mt-1 text-[13.5px] text-faint">left · {p.moved}</div>
            <div className="mt-4 text-[17px] leading-snug">
              <span className="text-out">Pays: </span>
              {p.pays}
            </div>
            <div className="mt-2 text-[17px] leading-snug text-muted">
              <span className="text-help">Never: </span>
              {p.never}
            </div>
          </div>
        ))}
      </div>
      {bills.length > 0 && (
        <div className="mt-5">
          <div className="text-[15px] text-muted">Rescue trips billed to operations</div>
          <ul className="mt-2 divide-y divide-line">
            {bills.slice(0, 6).map((b) => (
              <li key={`${b.transactionId ?? b.at}`} className="flex justify-between gap-3 py-2 text-[15px]">
                <span className="truncate">
                  {b.vehicleName} · {b.label.split(" · ")[0]}
                </span>
                <span className="shrink-0 font-mono tabular-nums">{dollars(b.cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
