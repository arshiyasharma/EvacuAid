// Exercises the Nessie bank layer end to end against the real sandbox.
// Run: bun --env-file=.env.local scripts/nessie-check.ts
import { ensureBank, fundSnapshot, reliefCardPurchase, requestStipend, waitForSettled } from "../src/lib/bank/nessie";

const home = { lng: -118.1534, lat: 34.1902 };
await ensureBank();
console.log("bank ready");

const honest = await requestStipend({ id: "check-honest", name: "Maria Lopez", address: "1117 Altadena Dr", home, history: "local" }, { noTransport: true });
console.log("honest:", honest.decision, honest.checks.map((c) => `${c.name}=${c.result}`).join(", "));

const vegas = await requestStipend({ id: "check-vegas", name: "Dan Reyes", address: "1949 El Molino Ave", home, history: "vegas" }, {});
console.log("vegas:", vegas.decision, vegas.checks.filter((c) => c.result !== "pass").map((c) => c.detail).join(" | "));

const outside = await requestStipend({ id: "check-outside", name: "Sam Lee", address: "200 Main St", zip: "90012", home, history: "local" }, {});
console.log("outside zone:", outside.decision, outside.checks.find((c) => c.name === "Residency")?.detail);

const again = await requestStipend({ id: "check-honest", name: "Maria Lopez", address: "1117 Altadena Dr", home }, {});
console.log("second claim:", again.decision, again.checks.find((c) => c.name === "Duplicate claim")?.detail);

console.log("waiting for the stipend to settle:", (await waitForSettled(honest.transactionId!)).status);
const gas = await reliefCardPurchase("check-honest", "shell-pasadena", 48_00);
console.log("relief card gas:", gas.approved ? "approved" : "declined");
const tv = await reliefCardPurchase("check-honest", "electronics-glendale", 129_00);
console.log("relief card electronics:", tv.approved ? "approved" : "declined");

console.log("fund:", await fundSnapshot());
