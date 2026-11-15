// Everything the pitch page says that isn't layout.

export const PROGRAM_ID = "HZYxz8EF9iqNERbZucuTygzGVHNc9xfrw1YtwEqYBV3";
export const PROGRAM_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

/** Reporting on the night, paraphrased, with the original links. */
export const PHOTO = {
  src: "https://images-assets.nasa.gov/image/iss072e454582/iss072e454582~large.jpg",
  credit: "NASA / Don Pettit, International Space Station · Jan 10, 2025, 2:30 AM",
  page: "https://images.nasa.gov/details/iss072e454582",
};

export const STORY = {
  source: "https://www.npr.org/2025/01/13/g-s1-42506/la-fires-victims-altadena-eaton-anthony-mitchell",
  lines: [
    "Altadena. January 8, 2025.",
    "Anthony Mitchell Sr., 67, couldn't walk on his own. His son Justin had cerebral palsy.",
    "They called for an ambulance. They waited.",
  ],
  punch: "It never came.",
};

export const AFTER = [
  {
    outlet: "LAist",
    headline: "Survivors denied FEMA housing help months after the fire",
    url: "https://laist.com/news/climate-environment/fema-aid-la-fires",
  },
  {
    outlet: "NPR",
    headline: "Underinsured survivors denied federal loans; one emergency check so far",
    url: "https://www.npr.org/transcripts/nx-s1-5704233",
  },
  {
    outlet: "CalMatters",
    headline: "Still displaced, running out of money, waiting for aid that may not come",
    url: "https://calmatters.org/economy/2026/10/la-fire-survivors-federal-disaster-aid/",
  },
];

export const NEWS = [
  {
    outlet: "Los Angeles Times",
    headline: "West Altadena residents say evacuation alerts came late, or never came",
    url: "https://www.yahoo.com/news/la-fires-delayed-wildfire-evacuation-183334965.html",
    tone: "#ff6b35",
  },
  {
    outlet: "Los Angeles Times",
    headline: "Signs of flames in west Altadena hours before the evacuation order",
    url: "https://www.yahoo.com/news/eaton-fire-evacuation-orders-possibly-222814860.html",
    tone: "#ff6b35",
  },
  {
    outlet: "NBC News",
    headline: "Most victims were over 65, disabled, or both: they had no way out",
    url: "https://www.nbcnews.com/news/us-news/los-angeles-california-wildfires-victims-no-escape-rcna191087",
    tone: "#f43f5e",
  },
  {
    outlet: "FOX Weather",
    headline: "A disabled father and son died after a medical evacuation never came",
    url: "https://www.foxweather.com/extreme-weather/eaton-fire-victims-disabled-father-son-family-story",
    tone: "#f43f5e",
  },
  {
    outlet: "ABC7",
    headline: "Altadena seniors say they were stranded as the Eaton fire raged",
    url: "https://abc7.com/post/altadena-senior-community-mirador-apartments-demands-action-say-were-stranded-during-eaton-fire/16282848/",
    tone: "#f59e0b",
  },
  {
    outlet: "Firehouse",
    headline: "The fires show the need for a list of residents who can't leave alone",
    url: "https://firehouse.com/california-fire-storm/news/55262499/ca-wildfires-show-need-for-database-of-disabled-residents",
    tone: "#f59e0b",
  },
];

export const WHY_NOT_SAVED = [
  { n: "3:25 AM", title: "The order came last", body: "Satellites saw fire at the homes at 1:02 AM." },
  { n: "One-way", title: "Alerts can't listen", body: "Nobody learned who couldn't leave." },
  { n: "16 of 19", title: "Couldn't leave alone", body: "Elderly, disabled, or limited mobility." },
  { n: "0", title: "List of who needs a ride", body: "LA is only now building one." },
  { n: "1", title: "Language on most alerts", body: "Altadena speaks many." },
];

export const MONEY_PROBLEM = [
  { n: "After", title: "Aid comes after the fire", body: "FEMA's $770 needs a declaration and an application." },
  { n: "$500M → 6", title: "Donors can't see", body: "Red Cross raised $500M for Haiti and built 6 homes.", url: "https://www.npr.org/2015/06/03/411524156/in-search-of-the-red-cross-500-million-i" },
  { n: "Fake", title: "Fraud drains it", body: "LA fire aid was claimed with fake addresses.", url: "https://www.justice.gov/usao-cdca/pr/5-defendants-arrested-complaints-alleging-they-submitted-fraudulent-claims-seeking" },
  { n: "No car", title: "The neediest can't front it", body: "Gas and a room tonight, money back next month." },
];

export const BEFORE_AFTER = {
  evacuation: [
    ["Alert", "3:25 AM, one-way", "6:49 PM, two-way"],
    ["Who can't leave?", "Unknown", "They text back: 1, 2, 3"],
    ["A ride", "Call 911 and wait", "Operator dispatches in one click"],
    ["Language", "English", "Any language, Gemini"],
    ["Silent homes", "Nobody checks", "Two texts, then a door knock"],
  ],
  money: [
    ["When", "Weeks after", "Tonight"],
    ["How much", "Paperwork decides", "Two questions size it: $150–$770"],
    ["Fraud", "Found later, if ever", "Five bank checks before a dollar moves"],
    ["What it buys", "Anything", "Only gas, rooms, food, medicine"],
    ["Donors see", "A thank-you email", "Every dollar on Solana"],
  ],
};

export type Feature = { title: string; body: string; group?: string; why?: string };

export type Track = {
  key: string;
  name: string;
  color: string;
  glow: string;
  oneLiner: string;
  irreplaceable: string[];
  features: Feature[];
  apis: string[];
  links: { label: string; href: string }[];
  proof: { n: string; label: string }[];
};

export const TRACKS: Track[] = [
  {
    key: "nessie",
    name: "Capital One · Nessie",
    color: "#ff5a4f",
    glow: "rgba(208,48,39,0.35)",
    oneLiner: "Not just a ledger: a bank, a fraud engine, a budget simulator, and the rescue's accounting.",
    irreplaceable: [
      "Only a bank knows where a card was used an hour ago. That's how EvacuAid catches the Vegas claim.",
      "Money is a rescue tool: people stay because leaving costs money. The bank moves it during the fire.",
      "Every dollar is a real ledger entry, so the county gets FEMA's 75% back without paperwork.",
    ],
    features: [
      { group: "Bank", title: "4 kinds of wallets", body: "County relief account · County Emergency Operations · Solana bridge · a checking + Relief Card per household.", why: "Rescue spending, donor money and family aid never mix, so each can be audited on its own." },
      { group: "Fraud engine", title: "5 bank checks", body: "Residency (ZIP) · whereabouts (card geodistance) · account history · $770 household cap · story vs. spending.", why: "Fraud follows every disaster. Card history proves who was really there." },
      { group: "Fraud engine", title: "Decisions API", body: "Approve, hold, or decline every dollar with a reason. Held claims move no money until a person says yes.", why: "A person, not a model, has the last word on money." },
      { group: "Bank", title: "Sized aid", body: "$150 gas · $315 gas + a night · $770 full. Top-ups, and a red confirm before any operator override.", why: "A gas tank isn't a hotel week. Smaller asks stretch the fund further." },
      { group: "Bank", title: "Card that only evacuates", body: "Purchases at 12 geocoded merchants. Gas, rooms, food, pharmacy: approved. Electronics: declined.", why: "Aid buys the way out, not a TV." },
      { group: "Bank", title: "Settlement, live", body: "Pending → completed on Nessie's sweep, streamed to the Live transactions feed.", why: "The operator sees money land, not just get promised." },
      { group: "Operations", title: "Rescue billing", body: "Every dispatch is a purchase on County Emergency Operations: $95 paratransit, $70 van, $25 volunteer fuel.", why: "The county knows what saving each person cost, while it happens." },
      { group: "Simulator", title: "Monte Carlo budget", body: "2,000 simulated nights per plan, re-run every 15 replay minutes: chance the money lasts, likely vs. bad night.", why: "Running out at 2 AM is the real risk. This sees it at 9 PM." },
      { group: "Simulator", title: "Best-plan optimizer", body: "Searches up to 98 policies; found $770 + shelter-first lasts 90% (from 58%) and saves $9,240.", why: "The operator picks a plan with numbers, not a guess." },
      { group: "Simulator", title: "Budget sandbox", body: "Change aid, shelter share, room nights, fire speed, Solana pool: watch the odds move.", why: "Ask 'what if the fire doubles?' before it does." },
      { group: "Operations", title: "FEMA Category B export", body: "One click: every approved dollar, itemized with its Nessie transaction, 75% share computed.", why: "Every dollar comes back 75% from FEMA because it's already itemized." },
      { group: "Operations", title: "Runs + history", body: "Each drill is a run; reset archives it. Nothing is ever lost.", why: "Drills and real nights never overwrite each other." },
    ],
    apis: [
      "POST /customers",
      "POST /customers/{id}/accounts",
      "POST /merchants",
      "GET /accounts/{id}/transactions",
      "POST /accounts/{id}/transfers",
      "POST /transactions/{id}/decision",
      "POST /accounts/{id}/purchases",
      "POST /transactions/{id}/settle",
      "GET /transactions/{id}",
      "GET /accounts/{id}",
    ],
    links: [
      { label: "Relief fund (live)", href: "/relief" },
      { label: "Operator console", href: "/console" },
    ],
    proof: [
      { n: "10", label: "Nessie endpoints" },
      { n: "4", label: "wallet types" },
      { n: "5", label: "fraud checks" },
      { n: "6,000", label: "nights simulated per refresh" },
    ],
  },
  {
    key: "tiger",
    name: "Tiger Data",
    color: "#f5c518",
    glow: "rgba(245,197,24,0.3)",
    oneLiner: "The incident's memory: every text, case, dispatch and dollar as a time-series row.",
    irreplaceable: [
      "A disaster is a time series. Questions like 'how many replies in the last 5 minutes?' are what TimescaleDB is built for.",
      "Continuous aggregates make the live charts cheap enough to refresh every minute during the worst night.",
      "The same table becomes the after-action report and the audit trail, per run.",
    ],
    features: [
      { group: "Schema", title: "evac_events hypertable", body: "Partitioned by time in 1-day chunks. 18 event kinds: texts in/out, cases, dispatches, Nessie and Solana transactions.", why: "One table for the whole night, fast no matter how big it gets." },
      { group: "Rollups", title: "Continuous aggregate", body: "evac_events_5min: time_bucket('5 minutes'), real-time (materialized_only = false).", why: "Live charts without re-scanning every row." },
      { group: "Rollups", title: "Refresh policy", body: "Re-materializes every minute over the last 2 days.", why: "The dashboard is never more than a minute behind." },
      { group: "Rollups", title: "Compression policy", body: "Segment by run and kind; compresses chunks older than 7 days.", why: "Every night is kept for the after-action report, cheaply." },
      { group: "Schema", title: "Index for the console", body: "(run, kind, time desc): per-run queries in milliseconds.", why: "The operator's view loads instantly during the worst hour." },
      { group: "In the app", title: "Never blocks a rescue", body: "Fire-and-forget writes: if the database is unreachable, the van still goes.", why: "Analytics can fail. A ride can't." },
      { group: "In the app", title: "Live charts", body: "Texts, cases, vehicles sent, aid approved, Solana released, events per 5 minutes.", why: "Spot the surge in texts before the queue backs up." },
    ],
    apis: ["create_hypertable", "time_bucket", "continuous aggregate", "add_continuous_aggregate_policy", "compression", "add_compression_policy", "PostgreSQL 18 · TimescaleDB 2.32"],
    links: [{ label: "Live charts on the relief fund", href: "/relief" }],
    proof: [
      { n: "18", label: "event kinds" },
      { n: "5 min", label: "rollups, real-time" },
      { n: "1 min", label: "refresh policy" },
    ],
  },
  {
    key: "solana",
    name: "Solana",
    color: "#14f195",
    glow: "rgba(153,69,255,0.35)",
    oneLiner: "Donor money with rules in code: released by the evacuation order, capped per home, public to everyone.",
    irreplaceable: [
      "Relief waits for paperwork because donors must trust whoever holds the money. A program doesn't ask for trust.",
      "The rules are agreed before the fire, so no one approves each payout during it.",
      "Anyone can audit every release live, from anywhere, at 3 a.m.",
    ],
    features: [
      { group: "Program", title: "Anchor program, deployed", body: "relief_pool on devnet (Anchor 1.2.2), IDL published on-chain so Explorer decodes it.", why: "Anyone can read the exact rules running the money." },
      { group: "Program", title: "4 instructions", body: "init_pool · donate · publish_order · release.", why: "The whole lifecycle of a gift, and nothing else." },
      { group: "Program", title: "PDAs", body: "Pool, token vault, a zone per evacuation order, a claim per household hash.", why: "Each home's claim is its own account, so double-dipping is impossible." },
      { group: "Rules in code", title: "Order-gated", body: "release needs the zone account the county creates with publish_order. The console's Send alert publishes it.", why: "Money only moves for homes the county actually ordered out." },
      { group: "Rules in code", title: "$770 cap per home", body: "Enforced by the claim PDA, however the aid is split.", why: "No one home can drain the pool, even with an operator's help." },
      { group: "Rules in code", title: "Payout fixed", body: "has_one county_payout: money can only go to the county's relief account.", why: "Even a stolen key can't send donor money elsewhere." },
      { group: "Rules in code", title: "Custom errors", body: "ZoneNotOrdered · OverHouseholdCap · WrongPayout, all proven refused on devnet.", why: "Each rule is proven refused on devnet, not just promised." },
      { group: "Program", title: "SPL tokens", body: "A 6-decimal test dollar standing in for USDC; transfer_checked CPI with a PDA signer.", why: "A real stablecoin flow, ready to swap for USDC." },
      { group: "Trust", title: "Two-way audit", body: "Each release records the Nessie transaction that paid the family.", why: "Chain and bank point at each other: gift to family, end to end." },
      { group: "Trust", title: "Public donations", body: "/donate sends a real devnet donate(); your receipt shows which families your gift reached.", why: "Donors see who they helped. That's why they give again." },
    ],
    apis: ["Anchor 1.2.2", "@anchor-lang/core", "@solana/web3.js", "@solana/spl-token", "PDAs", "CPI transfer_checked", "Events"],
    links: [
      { label: "Program on Explorer", href: PROGRAM_URL },
      { label: "Donate + receipts", href: "/donate" },
      { label: "Relief fund", href: "/relief" },
    ],
    proof: [
      { n: "4", label: "instructions" },
      { n: "3", label: "rules refused on-chain" },
      { n: "$60,000", label: "donated on devnet" },
    ],
  },
  {
    key: "gemini",
    name: "Gemini API",
    color: "#7aa2ff",
    glow: "rgba(66,133,244,0.35)",
    oneLiner: "Turns a panicked text in any language into a structured case an operator can act on in seconds.",
    irreplaceable: [
      "People don't reply '3'. They write 'my mom can't walk and the car's in the shop', or in Spanish.",
      "Structured output means the engine never parses free text: code decides, AI reads.",
      "Two seconds per message is fast enough to triage a whole neighborhood live.",
    ],
    features: [
      { group: "Understanding", title: "Management prompt", body: "Mission, stages, needs, safety rules, and worked examples in English and Spanish.", why: "It knows the mission, so replies stay on task." },
      { group: "Understanding", title: "Structured JSON", body: "status · stage · needs · leftBehind · emergency · offerStipend · language · summary · reply.", why: "Code makes the decisions. AI only reads." },
      { group: "Understanding", title: "Any language", body: "Replies in the resident's language; Spanish stories run end to end.", why: "The people left behind are often the ones who don't speak English." },
      { group: "Safety", title: "Guardrails", body: "Never promises a ride or an amount. If it says 'on the way' before dispatch, code replaces it.", why: "It never promises what a person hasn't approved." },
      { group: "Engine", title: "Hybrid engine", body: "A 14-stage state machine handles menu replies instantly; Gemini handles everything else.", why: "Menu replies are instant and free. AI only when it's needed." },
      { group: "Engine", title: "Operator summaries", body: "Every case card starts with Gemini's one-line summary.", why: "An operator triages fifty cases in a glance." },
      { group: "Safety", title: "Fallback", body: "If Gemini fails, keyword rules answer, so no text is ever dropped.", why: "No text is ever dropped." },
    ],
    apis: ["Gemini Interactions API", "gemini-3.5-flash-lite", "thinking: minimal", "JSON schema output", "@google/genai"],
    links: [
      { label: "Text it: web phone", href: "/phone" },
      { label: "See the cases", href: "/console" },
    ],
    proof: [
      { n: "~2 s", label: "per message" },
      { n: "9", label: "structured fields" },
      { n: "14", label: "conversation stages" },
    ],
  },
  {
    key: "vultr",
    name: "Vultr",
    color: "#3b8bff",
    glow: "rgba(0,123,252,0.35)",
    oneLiner: "The always-on front door: a public HTTPS address that stays up while the operator's station runs the night.",
    irreplaceable: [
      "EvacuAid isn't a stateless website. It holds a live roster, checks iMessage every 2 seconds and times every van trip. Serverless functions forget all of that between requests; a Vultr machine doesn't.",
      "Judges, donors and residents need one address that never changes and always has HTTPS. Vultr holds it, with the certificate, the firewall and the backups.",
      "A full standby copy of the app lives on the same server. If the operator's laptop goes down, one command moves the whole night there, data included.",
    ],
    features: [
      { group: "Edge", title: "Cloud Compute, Ubuntu 24.04", body: "2 vCPU, 4 GB, one fixed IP that evacuid.us points to.", why: "One address for judges, donors and residents, whatever happens behind it." },
      { group: "Edge", title: "Automatic HTTPS", body: "Caddy gets and renews the certificate on its own, with compression.", why: "Operator sign-in uses secure cookies, which only work over HTTPS." },
      { group: "Edge", title: "Firewall", body: "ufw: only SSH, 80 and 443 open. The app itself listens on 127.0.0.1 only.", why: "Nothing reaches the app except through the HTTPS front door." },
      { group: "Edge", title: "Tunnel to the operator station", body: "An SSH reverse tunnel carries evacuid.us to the laptop running the night, and reconnects on its own.", why: "One live copy, so no resident ever gets two replies to a text." },
      { group: "Standby", title: "Full app, ready", body: "Node 22, Bun, a systemd service that restarts in 2 seconds, release folders.", why: "The night can move to the cloud in one command." },
      { group: "Standby", title: "Deploys that can't break the site", body: "Build in a new folder, smoke-test 34 checks on the real domain, roll back automatically.", why: "A bad change never reaches a resident." },
      { group: "Standby", title: "Switch both ways", body: "switch-to-server and switch-to-laptop carry the data along: phones, conversations, ledger, runs.", why: "Nothing is lost moving between machines." },
      { group: "Safety", title: "Nightly backups", body: "The night's data, archived every night (14 kept), plus a copy before every deploy and switch.", why: "Every phone, dollar and decision can be restored." },
      { group: "Safety", title: "Secrets locked down", body: "Keys and the Solana wallet sit in a folder only the app's own user can read.", why: "A compromised page can't read the county's keys." },
    ],
    apis: ["Vultr Cloud Compute", "Ubuntu 24.04", "Caddy (auto HTTPS)", "ufw", "systemd", "SSH reverse tunnel", "Node 22"],
    links: [
      { label: "evacuid.us", href: "https://evacuid.us" },
      { label: "Relief fund (live)", href: "/relief" },
    ],
    proof: [
      { n: "34", label: "checks on every deploy" },
      { n: "2 s", label: "crash restart" },
      { n: "14", label: "nightly backups kept" },
    ],
  },
];

export const STACK = [
  { name: "Next.js 16", what: "App router, server routes", cat: "Web" },
  { name: "React 19", what: "Console, relief, donate, pitch", cat: "Web" },
  { name: "TypeScript", what: "Everything", cat: "Web" },
  { name: "Tailwind 4", what: "Design system", cat: "Web" },
  { name: "MapLibre + MapTiler", what: "Live fire map", cat: "Maps" },
  { name: "NASA FIRMS", what: "365 real satellite fire detections", cat: "Data" },
  { name: "Gemini 3.5 Flash-Lite", what: "Triage in any language", cat: "AI" },
  { name: "Photon iMessage", what: "Two-way texts on real phones", cat: "Messaging" },
  { name: "Capital One Nessie v2", what: "Accounts, checks, transfers, purchases", cat: "Money" },
  { name: "Solana devnet", what: "Donor pool with on-chain rules", cat: "Money" },
  { name: "Anchor 1.2.2", what: "relief_pool program", cat: "Money" },
  { name: "SPL Token", what: "Test dollar (USDC stand-in)", cat: "Money" },
  { name: "Tiger Data", what: "Hypertable + continuous aggregates", cat: "Data" },
  { name: "PostgreSQL 18", what: "TimescaleDB 2.32", cat: "Data" },
  { name: "jose", what: "Signed operator sessions", cat: "Security" },
  { name: "scrypt", what: "Operator password hashing", cat: "Security" },
  { name: "Vultr", what: "Public HTTPS edge, firewall, standby server", cat: "Infra" },
  { name: "Caddy", what: "Automatic HTTPS certificates", cat: "Infra" },
  { name: "Vitest", what: "34 automated tests", cat: "Quality" },
  { name: "Bun", what: "Runtime and scripts", cat: "Quality" },
];

export const DIFFERENT = [
  ["The disaster", "Built around one hazard", "Any evacuation: fire, flood, hurricane, earthquake, chemical spill"],
  ["The proof", "A modeled disaster on a map", "The real Eaton fire: 365 NASA detections, the real 3:25 AM order"],
  ["The people", "Synthetic households", "Real phones. Text EVAC right now and an operator answers"],
  ["Reaching them", "A browser call or a one-way alert", "Two-way iMessage, any language, on the phone they already have"],
  ["Who decides", "An algorithm assigns", "AI suggests; a person approves every van and every dollar"],
  ["After the pickup", "The story ends at the van", "Sized aid the same night, on a card that only buys the way out"],
  ["Fraud", "Not considered", "Five bank checks on real card history; a blocked claim moves $0"],
  ["Donors", "Not considered", "On-chain rules, public releases, a receipt naming who they reached"],
  ["The budget", "Not considered", "6,000 simulated nights per refresh: will the money last till morning?"],
  ["The county", "Not considered", "Every rescue billed, every dollar itemized for FEMA's 75% back"],
  ["Running it", "A demo that dies with the laptop", "Live at evacuid.us on Vultr: HTTPS, backups, a standby server"],
  ["Proof", "A simulated town", "200 paired runs on the real night: +176 people in every one"],
];

export const SOFTWARE = [
  { n: "~10k", label: "lines of TypeScript" },
  { n: "297", label: "lines of Rust on-chain" },
  { n: "34", label: "automated tests" },
  { n: "19", label: "conversation types, EN + ES" },
  { n: "3", label: "Monte Carlo engines" },
  { n: "5", label: "sponsor platforms, all live" },
];

/** One night, start to finish: which system does what, phase by phase. */
export const PHASES = ["Before the fire", "The alert", "They reply", "Operator decides", "Money moves", "After"];

export type Cell = { key: string; text: string } | null;
export type SwimRow = { who: string; color: string; cells: Cell[] };

const C = { nessie: "#ff5a4f", solana: "#14f195", gemini: "#7aa2ff", tiger: "#f5c518", photon: "#a3a3ad", ops: "#ededee" };

export const SWIM: SwimRow[] = [
  {
    who: "Solana",
    color: C.solana,
    cells: [
      { key: "donate()", text: "Donors fill the pool. Rules fixed in code." },
      { key: "publish_order()", text: "Only the ordered zone unlocks." },
      null,
      null,
      { key: "release()", text: "Pool pays the county back. ≤ $770 a home." },
      { key: "receipt", text: "Donors see which families they reached." },
    ],
  },
  {
    who: "iMessage + Gemini",
    color: C.gemini,
    cells: [
      null,
      { key: "Photon", text: "A two-way text, hours early." },
      { key: "JSON case", text: "Any words, any language → needs, stage, summary." },
      { key: "summary", text: "One line on every case card." },
      { key: "status texts", text: "“Van is 6 min away.” A live link to watch it come." },
      null,
    ],
  },
  {
    who: "EvacuAid + operator",
    color: C.ops,
    cells: [
      { key: "NASA FIRMS", text: "The real fire, forecast house by house." },
      { key: "who's at risk", text: "Zones ordered, homes texted." },
      { key: "case", text: "Ride, aid, or a door knock. Best free van suggested." },
      { key: "approve", text: "A person approves every van and every dollar." },
      { key: "dispatch", text: "Van picks them up. They track it live, like a ride-share." },
      { key: "check-in", text: "Safe at the shelter. Nobody lost track of." },
    ],
  },
  {
    who: "Nessie",
    color: C.nessie,
    cells: [
      { key: "accounts", text: "$120k relief fund, $250k rescue ops, a card per home." },
      null,
      { key: "GET /transactions", text: "5 bank checks: was this card really here?" },
      { key: "POST /decision", text: "Approve, hold or decline, with a reason." },
      { key: "POST /transfers", text: "$150 · $315 · $770 on the relief card, in seconds. Trip billed." },
      { key: "POST /purchases", text: "Gas and rooms only. FEMA export." },
    ],
  },
];

export const SWIM_TIGER = "Every cell above writes a row to one hypertable, by the minute: live charts tonight, the after-action report tomorrow.";

export const TWO_RAILS = [
  {
    name: "Solana",
    color: C.solana,
    job: "Trust between strangers",
    body: "Holds donor money. Rules in code: only ordered zones, $770 a home, county only.",
    cant: "Can't see a card swiped in Las Vegas.",
  },
  {
    name: "Nessie",
    color: C.nessie,
    job: "The bank families actually use",
    body: "Pays families in seconds, checks card history for fraud, limits what the card buys.",
    cant: "Can't prove to a stranger the rules never changed.",
  },
];

/** Where other tools stop. */
export const JOURNEY = [
  { step: "Warned", body: "A two-way text, hours early", stop: "Alert apps stop here" },
  { step: "Out", body: "A van for whoever can't drive", stop: "Evacuation tools stop here" },
  { step: "Covered", body: "Sized aid, fraud-checked, tonight", stop: "" },
  { step: "Spent right", body: "A card that only buys the way out", stop: "" },
  { step: "Seen", body: "Every donor sees who they helped", stop: "" },
];

export const NESSIE_CALLS: { call: string; why: string }[] = [
  { call: "POST /customers", why: "A customer per home: the ZIP is the residency check." },
  { call: "POST /customers/{id}/accounts", why: "Relief fund, rescue ops, Solana bridge, a card per family." },
  { call: "POST /merchants", why: "Real gas stations, hotels and pharmacies on the routes." },
  { call: "GET /accounts/{id}/transactions", why: "Where was this card an hour ago? Fraud check." },
  { call: "POST /accounts/{id}/transfers", why: "Aid to the family's relief card, only after approval." },
  { call: "POST /transactions/{id}/decision", why: "Approve, hold or decline, always with a reason." },
  { call: "POST /accounts/{id}/purchases", why: "Card swipes and every van trip, billed live." },
  { call: "POST /transactions/{id}/settle", why: "Watch the money actually land." },
  { call: "GET /transactions/{id}", why: "Pending → paid, on the live feed." },
  { call: "GET /accounts/{id}", why: "Live balances for the fund, cards and pool." },
];

export const CLAIM_TODAY = ["Disaster declared", "Claim filed", "Inspection", "Denied or delayed", "Check, maybe"];
export const CLAIM_EVACUAID = ["Replies to the text", "Bank checks pass", "Money on the card"];

/** Fire is the proof, not the limit: only the hazard feed changes. */
export const HAZARDS = [
  { name: "Wildfire", feed: "NASA satellite detections", note: "Proven on the Eaton fire", live: true },
  { name: "Flood", feed: "River gauges, flood forecasts", note: "When water reaches each home" },
  { name: "Hurricane", feed: "Storm-surge and wind forecasts", note: "Days of warning, same roll call" },
  { name: "Earthquake", feed: "Damage and aftershock reports", note: "No warning: find who's trapped, house them tonight" },
  { name: "Chemical spill", feed: "Plume models", note: "Minutes to clear a zone" },
];
