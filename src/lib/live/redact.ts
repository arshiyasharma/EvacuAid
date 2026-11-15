// What the public may see. Real residents become anonymous dots: no phone,
// no name, no messages. Fictional 555 numbers (the web phone) stay visible so
// the demo phone can show its own thread.

import type { LiveHousehold } from "./store";

/** NANP 555-01xx..555-99xx style fictional numbers: +1 AAA 555 XXXX. */
export const isDemoPhone = (phone: string) => /^\+1\d{3}555\d{4}$/.test(phone);

export function redactHousehold(h: LiveHousehold): LiveHousehold {
  // A tracking code is only for the resident who got it by text.
  if (isDemoPhone(h.phone)) return { ...h, track: undefined };
  return {
    ...h,
    track: undefined,
    name: "Resident",
    phone: "",
    summary: undefined,
    driver: undefined,
    messages: [],
    conv: { ...h.conv, leftBehind: h.conv?.leftBehind ? "someone at home" : undefined },
  };
}
