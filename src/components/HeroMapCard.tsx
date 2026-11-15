// The floating "live" map card on the landing page. Pure SVG, no data.

const ROADS = Array.from({ length: 9 }, (_, i) => -160 + i * 90);
const CROSS = Array.from({ length: 9 }, (_, i) => -140 + i * 95);

export function HeroMapCard() {
  return (
    <div className="panel relative aspect-square w-full overflow-hidden rounded-[22px]">
      <svg viewBox="0 0 540 540" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="ember" cx="100%" cy="20%" r="70%">
            <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#ff4d3a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ff4d3a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="route" x1="0" x2="1">
            <stop offset="0%" stopColor="#3ee07f" stopOpacity="0" />
            <stop offset="100%" stopColor="#3ee07f" />
          </linearGradient>
        </defs>

        <rect width="540" height="540" fill="#121215" />

        <g transform="rotate(-36 270 270)" stroke="#232328" strokeLinecap="round">
          {ROADS.map((x) => (
            <line key={`r${x}`} x1={x} y1={-200} x2={x} y2={760} strokeWidth={x % 180 === 20 ? 22 : 13} />
          ))}
          {CROSS.map((y) => (
            <line key={`c${y}`} x1={-200} y1={y} x2={760} y2={y} strokeWidth={y % 190 === 50 ? 20 : 11} />
          ))}
        </g>

        <path
          d="M300 120 C 340 150, 360 110, 410 140 S 470 120, 520 150"
          fill="none"
          stroke="#2b2b31"
          strokeWidth="5"
        />
        <path d="M60 420 C 120 380, 170 440, 230 400 S 330 430, 380 380" fill="none" stroke="#2b2b31" strokeWidth="5" />

        <rect width="540" height="540" fill="url(#ember)" />

        <circle cx="270" cy="300" r="190" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeDasharray="2 6" />

        <path
          d="M150 360 L 205 300 L 262 336 L 318 262 L 352 250"
          fill="none"
          stroke="url(#route)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="420"
          strokeDashoffset="420"
          style={{ animation: "draw 2.6s 0.6s cubic-bezier(0.16,1,0.3,1) forwards" }}
        />
      </svg>

      <div aria-hidden className="absolute left-1/2 top-[55.5%] size-[140%] -translate-x-1/2 -translate-y-1/2 opacity-80">
        <div className="sweep size-full rounded-full" />
      </div>

      <Marker x="65%" y="46%" color="var(--color-out)" ring big />
      <Marker x="78%" y="30%" color="var(--color-help)" ring />
      <Marker x="22%" y="34%" color="var(--color-silent)" />
      <Marker x="36%" y="22%" color="var(--color-silent)" />
      <Marker x="47%" y="70%" color="var(--color-leaving)" />

      <span className="label absolute left-[70%] top-[24%] text-[13px] text-help">Needs help</span>
      <span className="label absolute left-[22%] top-[66.5%] text-[13px]">Woodbury Rd</span>

      <div className="absolute left-6 top-5 flex w-[calc(100%-48px)] items-center justify-between">
        <span className="label inline-flex items-center gap-2 text-fg/80">
          <span className="live-dot size-2 rounded-full bg-out shadow-[0_0_10px_var(--color-out)]" />
          Roll call · live
        </span>
        <span className="label">31 need help</span>
      </div>

      <div className="absolute bottom-5 left-6">
        <div className="text-[18px] font-medium tracking-[0.18em] text-fg">WEST ALTADENA</div>
        <div className="mt-1.5 font-mono text-[15px] tracking-[0.06em] text-muted">34.1897° N, 118.1600° W</div>
      </div>
    </div>
  );
}

function Marker({
  x,
  y,
  color,
  ring = false,
  big = false,
}: {
  x: string;
  y: string;
  color: string;
  ring?: boolean;
  big?: boolean;
}) {
  const core = big ? 14 : 8;
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
      {ring && (
        <span
          className="pulse-ring absolute left-1/2 top-1/2 -ml-5 -mt-5 size-10 rounded-full border-2"
          style={{ borderColor: color }}
        />
      )}
      {big && (
        <span
          className="absolute left-1/2 top-1/2 -ml-6 -mt-6 size-12 rounded-full border-2"
          style={{ borderColor: color, boxShadow: `0 0 24px ${color}` }}
        />
      )}
      <span
        className="relative block rounded-full"
        style={{
          width: core,
          height: core,
          background: big ? "#fff" : color,
          boxShadow: `0 0 ${core * 2}px ${color}`,
        }}
      />
    </span>
  );
}
