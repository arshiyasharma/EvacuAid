// The resident conversation as a state machine. Menu replies (1/2/3, A-D, Y/N,
// a number) are handled here, instantly and predictably. Anything else goes to
// Gemini with the management prompt, the stage, and the history.
//
// Every need becomes a case the operator decides on:
//   ride  – can't leave without a vehicle (money doesn't help them)
//   aid   – can drive, but cost is the barrier; EvacuAid sizes the aid first
//   check – silent after two texts: someone knocks on the door
// EvacuAid never dispatches or pays on its own; it tells the resident a person
// is reviewing, then texts every step once the operator acts.

import type { Needs, Status } from "../types";

export type Stage =
  | "awaiting_status"
  | "out_anyone_left"
  | "out_who_left"
  | "out_done"
  | "leaving_plan"
  | "aid_car"
  | "aid_dest"
  | "aid_review"
  | "leaving_done"
  | "help_what"
  | "help_people"
  | "ride_review"
  | "ride_dispatched"
  | "help_confirmed";

export const STAGES: Stage[] = [
  "awaiting_status",
  "out_anyone_left",
  "out_who_left",
  "out_done",
  "leaving_plan",
  "aid_car",
  "aid_dest",
  "aid_review",
  "leaving_done",
  "help_what",
  "help_people",
  "ride_review",
  "ride_dispatched",
  "help_confirmed",
];

export type AidSize = "gas" | "night" | "full";

/** What the operator sees and decides on. EvacuAid fills it in from the conversation. */
export type Case = {
  kind: "ride" | "aid" | "check";
  status: "gathering" | "review" | "dispatched" | "onboard" | "done" | "approved" | "held" | "declined";
  openedAt: number;
  people?: number;
  wheelchair?: boolean;
  medical?: boolean;
  hasCar?: boolean;
  destination?: "shelter" | "family" | "room";
  /** EvacuAid's suggestion for the operator. */
  aid?: AidSize;
  vehicleId?: string;
  vehicleName?: string;
  etaMin?: number;
};

export type Conv = {
  stage: Stage;
  /** Where to go back to after the money questions. */
  offerFrom?: "leaving" | "help";
  leftBehind?: string;
  emergency?: boolean;
  nudges: number;
  doorKnock: boolean;
  case?: Case;
  /** STOP was sent once while they still needed help: one more STOP confirms. */
  stopAsked?: boolean;
};

export const newConv = (): Conv => ({ stage: "awaiting_status", nudges: 0, doorKnock: false });

export type Step = {
  status?: Status;
  needs?: Partial<Needs>;
  stage: Stage;
  reply: string;
  summary: string;
  leftBehind?: string;
  offerFrom?: "leaving" | "help";
  /** Open or update the operator's case. */
  case?: Partial<Case> & { kind?: Case["kind"] };
};

type Lang = "en" | "es";
const L = (lang: string): Lang => (lang === "es" ? "es" : "en");

const SHELTER = {
  en: "Pasadena Civic Center shelter, 300 E Green St. Free, pets welcome.",
  es: "Refugio Pasadena Civic Center, 300 E Green St. Gratis, se aceptan mascotas.",
};

export const AID_TEXT: Record<AidSize, { en: string; es: string; cents: number }> = {
  gas: { en: "gas", es: "gasolina", cents: 150_00 },
  night: { en: "gas and a night in a room", es: "gasolina y una noche de hotel", cents: 315_00 },
  full: { en: "gas, food and two nights", es: "gasolina, comida y dos noches", cents: 770_00 },
};

export const ALERT = {
  en: [
    "🚨 EVACUATION WARNING · EATON FIRE 🚨",
    "",
    "This is EvacuAid for LA County. The fire is moving toward your area. LEAVE NOW if you can!",
    "",
    "Reply with a number:",
    "1 = I'M OUT / SAFE",
    "2 = LEAVING NOW",
    "3 = I NEED HELP",
    "",
    "Or tell us what you need, in any language. Responda en español si prefiere.",
    "",
    "Already safe and don't need updates? Reply STOP.",
  ].join("\n"),
};

export const T = {
  out: {
    en: "Glad you're safe.\n\nIs anyone still at your home: family, a neighbor, a pet? Reply Y or N.",
    es: "Nos alegra que esté a salvo.\n\n¿Queda alguien en su casa: familia, un vecino, una mascota? Responda S o N.",
  },
  outWho: {
    en: "Thank you for telling us. Who is still there, and can they leave on their own?",
    es: "Gracias por avisarnos. ¿Quién sigue ahí y puede salir por su cuenta?",
  },
  outDone: {
    en: `✅ You're marked SAFE.\n\nIf you need a place tonight: ${SHELTER.en}\n\nReply 3 if anything changes. Reply STOP if you don't need more messages.`,
    es: `✅ Está marcado A SALVO.\n\nSi necesita dónde quedarse: ${SHELTER.es}\n\nResponda 3 si algo cambia. Responda STOP si no necesita más mensajes.`,
  },
  leaving: {
    en: "Thank you. Do you have somewhere to stay tonight?\n\nA = Yes\nB = I need a shelter\nC = I can't afford gas or a room",
    es: "Gracias. ¿Tiene dónde quedarse esta noche?\n\nA = Sí\nB = Necesito un refugio\nC = No puedo pagar gasolina ni un cuarto",
  },
  leavingHasPlace: {
    en: "Good. Take medications, chargers, documents and pets.\n\nDrive safe and reply 1 when you get there.",
    es: "Bien. Lleve medicinas, cargadores, documentos y mascotas.\n\nManeje con cuidado y responda 1 cuando llegue.",
  },
  leavingShelter: {
    en: `Go to the ${SHELTER.en}\n\nReply 1 when you get there.`,
    es: `Vaya al ${SHELTER.es}\n\nResponda 1 cuando llegue.`,
  },
  aidCar: {
    en: "We can help with the cost of leaving. Two quick questions so we send the right amount.\n\nDo you have a car that runs and someone who can drive it? Reply Y or N.",
    es: "Podemos ayudar con el costo de salir. Dos preguntas rápidas para enviar la cantidad correcta.\n\n¿Tiene un carro que funcione y alguien que lo maneje? Responda S o N.",
  },
  aidNoCar: {
    en: "Then money won't get you out tonight, a ride will. How many people need a ride, including you? Reply a number, and tell us about pets.",
    es: "Entonces el dinero no le saca esta noche, un transporte sí. ¿Cuántas personas necesitan transporte, incluyéndole a usted? Responda un número y díganos si hay mascotas.",
  },
  aidDest: {
    en: "Where are you going tonight?\n\nA = The free shelter (pets welcome)\nB = Family or friends\nC = I need a room",
    es: "¿A dónde va esta noche?\n\nA = Al refugio gratuito (se aceptan mascotas)\nB = Con familia o amigos\nC = Necesito un cuarto",
  },
  aidReview: {
    en: (what: string, usd: string) =>
      `Thank you. An emergency operator is reviewing ${usd} for ${what} on your EvacuAid relief card now. You'll get a text in a few minutes.\n\nIf you can leave now, DON'T WAIT for it.`,
    es: (what: string, usd: string) =>
      `Gracias. Un operador de emergencias está revisando ${usd} para ${what} en su tarjeta de ayuda EvacuAid. Recibirá un mensaje en unos minutos.\n\nSi puede salir ahora, NO ESPERE.`,
  },
  aidApproved: {
    en: (usd: string, what: string) =>
      `✅ APPROVED: ${usd} for ${what} is on your EvacuAid relief card.\n\nIt ONLY works for gas, food, a room, medicine or transit. Anything else is declined.\n\nMoney you don't use goes back to the relief fund once you're safe.\n\nReply 1 when you get there.`,
    es: (usd: string, what: string) =>
      `✅ APROBADO: ${usd} para ${what} están en su tarjeta de ayuda EvacuAid.\n\nSOLO sirve para gasolina, comida, un cuarto, medicinas o transporte. Todo lo demás se rechaza.\n\nEl dinero que no use regresa al fondo de ayuda cuando esté a salvo.\n\nResponda 1 cuando llegue.`,
  },
  aidHeld: {
    en: "Your request needs one more check by the county, usually within minutes.\n\nDon't wait for it to leave if you can.",
    es: "Su solicitud necesita una revisión más del condado, normalmente en minutos.\n\nNo espere para salir si puede.",
  },
  aidDeclined: {
    en: `We couldn't approve this automatically. A county worker will follow up.\n\nPlease don't wait to leave. ${SHELTER.en}`,
    es: `No pudimos aprobarlo automáticamente. Alguien del condado le contactará.\n\nNo espere para salir. ${SHELTER.es}`,
  },
  help: {
    en: "🚨 We're on it. What's the main problem?\n\nA = Can't walk / wheelchair\nB = No car or ride\nC = Medical equipment (oxygen, dialysis)\nD = No money for gas or a room\n\nOr tell us in your own words.",
    es: "🚨 Estamos en eso. ¿Cuál es el problema principal?\n\nA = No puede caminar / silla de ruedas\nB = Sin carro\nC = Equipo médico (oxígeno, diálisis)\nD = Sin dinero para gasolina o cuarto\n\nO díganos con sus palabras.",
  },
  helpPeople: {
    en: "How many people need a ride, including you? Reply a number, and tell us about pets.",
    es: "¿Cuántas personas necesitan transporte, incluyéndole a usted? Responda un número y díganos si hay mascotas.",
  },
  rideReview: {
    en: (n: number, wheelchair: boolean) =>
      `Got it: ${n} ${n === 1 ? "person" : "people"}${wheelchair ? " and a wheelchair" : ""}.\n\nWe've requested a ${wheelchair ? "wheelchair-accessible vehicle" : "vehicle"} and an emergency operator is confirming it NOW.\n\nWait by your front door with your phone on. If fire reaches you, CALL 911.`,
    es: (n: number, wheelchair: boolean) =>
      `Entendido: ${n} ${n === 1 ? "persona" : "personas"}${wheelchair ? " y una silla de ruedas" : ""}.\n\nPedimos un ${wheelchair ? "vehículo accesible para silla de ruedas" : "vehículo"} y un operador de emergencias lo está confirmando AHORA.\n\nEspere junto a la puerta con el teléfono encendido. Si el fuego llega, LLAME AL 911.`,
  },
  stillHere: {
    en: "We have your request and an operator is on it. Wait by your front door with your phone on. Tell us if anything has changed.",
    es: "Tenemos su solicitud y un operador está en eso. Espere junto a la puerta con el teléfono encendido. Díganos si algo cambió.",
  },
  dispatched: {
    en: (vehicle: string, eta: number) =>
      `🚐 HELP IS ON THE WAY\n\n${vehicle} is coming to you, about ${eta} min.\n\nWait by the front door with your phone on. The driver will text when they're outside.`,
    es: (vehicle: string, eta: number) =>
      `🚐 LA AYUDA VA EN CAMINO\n\n${vehicle} va hacia usted, unos ${eta} min.\n\nEspere junto a la puerta con el teléfono encendido. El conductor le avisará cuando llegue.`,
  },
  outside: {
    en: (vehicle: string) => `🚐 ${vehicle} is OUTSIDE your home now.\n\nReply IN once you're seated.`,
    es: (vehicle: string) => `🚐 ${vehicle} está AFUERA de su casa ahora.\n\nResponda LISTO cuando esté sentado.`,
  },
  track: {
    en: (url: string) => `📍 Track your ride live: ${url}`,
    es: (url: string) => `📍 Siga su transporte en vivo: ${url}`,
  },
  notOutsideYet: {
    en: "Your ride isn't outside yet. We'll text you the moment it arrives.",
    es: "Su transporte aún no llegó. Le avisaremos en cuanto llegue.",
  },
  onboard: {
    en: `You're on board. Next stop: ${SHELTER.en}`,
    es: `Ya está a bordo. Próxima parada: ${SHELTER.es}`,
  },
  checkedIn: {
    en: "✅ You're checked in at the Pasadena Civic Center shelter. We're glad you're safe.\n\nReply STOP if you don't need more messages.",
    es: "✅ Está registrado en el refugio Pasadena Civic Center. Nos alegra que esté a salvo.\n\nResponda STOP si no necesita más mensajes.",
  },
  nudge1: {
    en: "⚠️ EvacuAid: We haven't heard from you and the fire is close. ARE YOU OKAY?\n\n1 = Out / safe\n2 = Leaving\n3 = I need help\n\nIf we don't hear back, a responder will check your home.",
    es: "⚠️ EvacuAid: No hemos sabido de usted y el fuego está cerca. ¿ESTÁ BIEN?\n\n1 = A salvo\n2 = Saliendo\n3 = Necesito ayuda\n\nSi no responde, un equipo revisará su casa.",
  },
  nudge2: {
    en: "⚠️ EvacuAid: A responder is being sent to check your home. If you're already out, reply 1.",
    es: "⚠️ EvacuAid: Enviamos a un equipo a revisar su casa. Si ya salió, responda 1.",
  },
  stopConfirm: {
    en: "Are you sure? We still have you down as needing help.\n\nReply STOP again to stop all messages, or 3 if you still need help.",
    es: "¿Está seguro? Todavía le tenemos como alguien que necesita ayuda.\n\nResponda STOP otra vez para dejar de recibir mensajes, o 3 si aún necesita ayuda.",
  },
  stopped: {
    en: "You won't get more EvacuAid messages. If you need help, text 3 anytime and we'll answer.",
    es: "No recibirá más mensajes de EvacuAid. Si necesita ayuda, envíe 3 cuando quiera y le responderemos.",
  },
};

export const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

/** Text the resident gets once the operator approves (or the bank checks hold/decline) aid. */
export function aidDecisionText(lang: string, decision: "approved" | "held" | "declined", size: AidSize, cents?: number) {
  const l = L(lang);
  if (decision === "approved") return T.aidApproved[l](usd(cents ?? AID_TEXT[size].cents), AID_TEXT[size][l]);
  if (decision === "held") return T.aidHeld[l];
  return T.aidDeclined[l];
}

// ---- parsing ---------------------------------------------------------------

const clean = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!?,]+$/g, "")
    .trim();

const YES = /^(y|yes|yeah|yep|ok|okay|sure|please|s|si|claro|acepto)$/;
const NO = /^(n|no|nope|nah|no gracias|no thanks)$/;
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };

const PET = /^(dogs?|cats?|pets?|perros?|gatos?|mascotas?|horses?|caballos?)$/;
const FILLER = new Set(["people", "persons", "person", "of", "us", "personas", "persona", "somos", "and", "y", "plus", "with", "con", "a", "the", "total"]);

/** One or more bare menu letters: "a", "A.", "a b", "a, b", "a and c". */
function letters(t: string, allowed: string): string[] | null {
  const tokens = t.split(/[\s,+&/]+/).filter((w) => w && w !== "and" && w !== "y");
  if (!tokens.length || !tokens.every((w) => w.length === 1 && allowed.includes(w))) return null;
  return [...new Set(tokens)];
}

/** "3", "three", "3 people", "2 + dog", "somos 4", "just me" → count and pets. */
function count(t: string): { n: number; pets: boolean } | null {
  if (/^(just me|only me|me|solo yo|yo)$/.test(t)) return { n: 1, pets: false };
  const tokens = t.split(/[\s+,&]+/).filter(Boolean);
  const pets = tokens.some((w) => PET.test(w));
  const rest = tokens.filter((w) => !PET.test(w) && !FILLER.has(w));
  if (rest.length !== 1) return null;
  const w = rest[0];
  if (/^\d{1,2}$/.test(w)) return { n: Number(w), pets };
  if (WORD_NUM[w] !== undefined) return { n: WORD_NUM[w], pets };
  return null;
}

/** Start sizing aid: ask about the car first (no car → it's really a ride). */
export function startAid(lang: string, from: "leaving" | "help"): Step {
  return {
    status: from === "leaving" ? "leaving" : "needs_help",
    needs: { money: true },
    stage: "aid_car",
    offerFrom: from,
    reply: T.aidCar[L(lang)],
    summary: "Says cost is the barrier · sizing aid",
    case: { kind: "aid", status: "gathering" },
  };
}

// ---- the machine -----------------------------------------------------------

/**
 * Handle a reply deterministically if it's a menu answer. Returns null when the
 * message needs understanding (free text), so the caller asks Gemini.
 */
export function step(conv: Conv, raw: string, lang: string, needs: Needs): Step | null {
  const t = clean(raw);
  const l = L(lang);

  // Waiting for a head count: numbers are people, not statuses.
  if (conv.stage === "help_people") {
    const c = count(t);
    if (c && c.n > 0 && c.n < 30) {
      const wheelchair = needs.mobility;
      return {
        status: "needs_help",
        needs: { people: c.n, noTransport: true, ...(c.pets ? { pets: true } : {}) },
        stage: "ride_review",
        reply: T.rideReview[l](c.n, wheelchair),
        summary: `Needs a ride: ${c.n} ${c.n === 1 ? "person" : "people"}${wheelchair ? ", wheelchair" : ""}${needs.medical ? ", medical equipment" : ""}${c.pets ? " + pets" : ""}`,
        case: { kind: "ride", status: "review", people: c.n, wheelchair, medical: needs.medical },
      };
    }
  }

  // 1 / 2 / 3 always mean status.
  if (t === "1") return { status: "out", stage: "out_anyone_left", reply: T.out[l], summary: "Out, checking for anyone left" };
  if (t === "2") return { status: "leaving", stage: "leaving_plan", reply: T.leaving[l], summary: "Leaving now" };
  if (t === "3" && (conv.stage === "ride_review" || conv.stage === "ride_dispatched" || conv.stage === "aid_review" || conv.stage === "help_confirmed"))
    return { status: "needs_help", stage: conv.stage, reply: T.stillHere[l], summary: "Still waiting for help" };
  if (t === "3") return { status: "needs_help", stage: "help_what", reply: T.help[l], summary: "Needs help, asking why" };

  switch (conv.stage) {
    case "out_anyone_left":
      if (YES.test(t))
        return {
          status: "needs_help",
          stage: "out_who_left",
          reply: T.outWho[l],
          summary: "Out, someone still at home",
          leftBehind: "someone still at home",
        };
      if (NO.test(t)) return { status: "out", stage: "out_done", reply: T.outDone[l], summary: "Out, nobody left behind" };
      return null;

    case "leaving_plan": {
      const k = letters(t, "abc");
      if (!k || k.length !== 1) return null;
      if (k[0] === "a") return { status: "leaving", stage: "leaving_done", reply: T.leavingHasPlace[l], summary: "Leaving, has a place" };
      if (k[0] === "b") return { status: "leaving", stage: "leaving_done", reply: T.leavingShelter[l], summary: "Leaving, going to shelter" };
      return startAid(lang, "leaving");
    }

    case "aid_car":
      if (YES.test(t)) return { stage: "aid_dest", reply: T.aidDest[l], summary: "Has a car · asking where they're going", case: { hasCar: true } };
      if (NO.test(t))
        return {
          status: "needs_help",
          needs: { noTransport: true },
          stage: "help_people",
          reply: T.aidNoCar[l],
          summary: "No working car · needs a ride, not money",
          case: { kind: "ride", status: "gathering", hasCar: false },
        };
      return null;

    case "aid_dest": {
      const k = letters(t, "abc");
      if (!k || k.length !== 1) return null;
      const destination = k[0] === "a" ? "shelter" : k[0] === "b" ? "family" : "room";
      const aid: AidSize = destination === "room" ? "night" : "gas";
      return {
        stage: "aid_review",
        reply: T.aidReview[l](AID_TEXT[aid][l], usd(AID_TEXT[aid].cents)),
        summary: `Has a car, going to ${destination === "room" ? "a room" : destination === "family" ? "family" : "the shelter"} · suggest ${usd(AID_TEXT[aid].cents)} ${AID_TEXT[aid].en}`,
        case: { kind: "aid", status: "review", hasCar: true, destination, aid },
      };
    }

    case "help_what": {
      const k = letters(t, "abcd");
      if (!k) return null;
      const n: Partial<Needs> = {};
      if (k.includes("a")) n.mobility = true;
      if (k.includes("b")) n.noTransport = true;
      if (k.includes("c")) n.medical = true;
      if (k.includes("d")) n.money = true;
      const label = [n.mobility && "can't walk", n.noTransport && "no car", n.medical && "medical equipment", n.money && "money"]
        .filter(Boolean)
        .join(", ");
      // Money alone: size the aid (and find out if they can actually drive).
      if (k.length === 1 && n.money) return startAid(lang, "help");
      return {
        status: "needs_help",
        needs: n,
        stage: "help_people",
        reply: T.helpPeople[l],
        summary: `Needs help: ${label}`,
        case: { kind: "ride", status: "gathering", wheelchair: n.mobility, medical: n.medical },
      };
    }
  }
  return null;
}
