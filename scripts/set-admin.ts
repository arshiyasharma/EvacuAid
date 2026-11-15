// Create or change the operator login. Run it yourself in a terminal:
//   bun scripts/set-admin.ts
// It asks for a username and password (the password is not shown or stored),
// and writes ADMIN_USERNAME, ADMIN_PASSWORD_HASH and SESSION_SECRET to .env.local.

import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let input = "";
    stdin.setRawMode?.(hidden);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      for (const c of ch) {
        // Some terminals send "\r\n" for Enter; a leftover line break must not submit an empty answer.
        if ((c === "\r" || c === "\n") && input === "") continue;
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(input);
        }
        if (c === "\u0003") process.exit(1); // Ctrl-C
        if (c === "\u007f") input = input.slice(0, -1);
        else input += c;
      }
    };
    stdin.on("data", onData);
  });
}

const username = (await ask("Operator username: ")).trim();
if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
  console.error("Use 3-40 letters, numbers, dot, dash or underscore.");
  process.exit(1);
}
const password = await ask("Password (12+ characters, hidden): ", true);
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
const again = await ask("Same password again: ", true);
if (again !== password) {
  console.error("Passwords don't match.");
  process.exit(1);
}

const N = 16384;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N });
const values: Record<string, string> = {
  ADMIN_USERNAME: username,
  // ":" separators and base64url: "$" would be expanded by .env loaders.
  ADMIN_PASSWORD_HASH: `scrypt:${N}:${salt.toString("base64url")}:${hash.toString("base64url")}`,
  SESSION_SECRET: randomBytes(32).toString("base64url"),
};

const file = ".env.local";
let env = existsSync(file) ? readFileSync(file, "utf8") : "";
for (const [k, v] of Object.entries(values)) {
  const line = `${k}=${v}`;
  env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
}
writeFileSync(file, env);
console.log(`Saved operator "${username}" to ${file}. Restart the server. Existing sessions are signed out.`);
