"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const smsLink = (n: string) => `sms:${n}&body=EVAC`;

function Qr({ value, size = 168 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 1, color: { dark: "#050506", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value]);
  return (
    <div
      className="shrink-0 overflow-hidden rounded-2xl bg-white p-2 shadow-[0_0_50px_-12px_rgba(255,255,255,0.5)]"
      style={{ width: size, height: size }}
      aria-label="QR code that opens Messages to EvacuAid"
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Text the number, scan the code, or leave your number here. */
export function SignUp({ number }: { number: string | null }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; address: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Something went wrong");
      setDone(j);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = done?.number ?? number;

  return (
    <section id="signup" className="mx-auto max-w-[1320px] px-6 pb-28 md:px-10">
      <div className="panel grid gap-10 rounded-[32px] p-8 md:p-12 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="label text-out">Try it on your phone</div>
          <h2 className="mt-4 text-[clamp(34px,4vw,52px)] font-medium leading-[1.02] tracking-[-0.035em]">
            Get the alert.
            <br />
            Answer it.
          </h2>
          <p className="mt-5 max-w-[460px] text-[19px] leading-relaxed text-muted">
            Sign up and you&apos;re placed at a real address in west Altadena. When the order goes out, EvacuAid texts you and
            your answer shows up live on the operator&apos;s map.
          </p>

          {shown && (
            <div className="mt-8 flex items-center gap-6">
              <a href={smsLink(shown)} aria-label={`Text EVAC to ${pretty(shown)}`}>
                <Qr value={smsLink(shown)} />
              </a>
              <div>
                <div className="text-[17px] text-muted">Text</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {["EVAC", "HI", "JOIN", "HELP"].map((w) => (
                    <span key={w} className="rounded-lg bg-white/[0.08] px-2.5 py-1 font-mono text-[16px] font-medium">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[17px] text-muted">to</div>
                <a href={smsLink(shown)} className="mt-1 block font-mono text-[30px] tracking-tight text-fg hover:text-out">
                  {pretty(shown)}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          {done ? (
            <div className="rise rounded-3xl border border-out/30 bg-out/[0.06] p-7">
              <div className="flex items-center gap-2.5 text-[20px] font-medium text-out">
                <span className="size-2.5 rounded-full bg-out shadow-[0_0_12px_var(--color-out)]" />
                You&apos;re on the list
              </div>
              <p className="mt-3 text-[18px] leading-relaxed">
                Your home in the drill: <span className="font-medium">{done.address}</span>
              </p>
              <p className="mt-3 text-[18px] leading-relaxed text-muted">
                Now text <span className="font-mono text-fg">EVAC</span> to{" "}
                <a href={smsLink(done.number)} className="font-mono text-fg underline decoration-white/30 underline-offset-4">
                  {pretty(done.number)}
                </a>{" "}
                from this phone, as an iMessage, to connect.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-[17px] text-muted" htmlFor="signup-phone">
                Or leave your number
              </label>
              <input
                id="signup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className="w-full rounded-2xl border border-line-strong bg-white/[0.02] px-5 py-4 text-[19px] outline-none placeholder:text-faint focus:border-white/40"
              />
              <div className="flex gap-2">
                <input
                  id="signup-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-0123"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="min-w-0 flex-1 rounded-2xl border border-line-strong bg-white/[0.02] px-5 py-4 font-mono text-[19px] outline-none placeholder:text-faint focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={busy || phone.replace(/\D/g, "").length < 10}
                  className="shrink-0 rounded-2xl bg-fg px-6 text-[18px] font-medium text-ink transition hover:bg-white disabled:opacity-40"
                >
                  {busy ? "Adding…" : "Sign up"}
                </button>
              </div>
              {error && <p className="text-[16px] text-help">{error}</p>}
              <p className="text-[15px] text-faint">iPhone only for now. We only text you during the drill. Reply STOP anytime.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
