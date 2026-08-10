#!/usr/bin/env node
/**
 * Turn an admin passphrase into the value for the ADMIN_PASSWORD_HASH secret.
 *
 *   node scripts/hash-password.mjs
 *
 * Reads the passphrase from stdin, prints only the hash on stdout, and never
 * writes it anywhere. Pipe it straight into wrangler so the passphrase never
 * touches the filesystem:
 *
 *   node scripts/hash-password.mjs | npx wrangler secret put ADMIN_PASSWORD_HASH
 *
 * On a terminal the input is not echoed. When stdin is a pipe the whole stream
 * is read as the passphrase, with any single trailing newline removed — reading
 * line-by-line would hang forever on input that has no newline at all.
 */
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 210_000;
const enc = new TextEncoder();

const b64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function readFromTty() {
  return new Promise((resolve, reject) => {
    process.stderr.write("Admin passphrase (input hidden): ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stderr.write("\n");
        resolve(buf);
      } else if (ch === "") {
        process.stdin.setRawMode(false);
        reject(new Error("cancelled"));
      } else if (ch === "") {
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function readFromPipe() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  const password = process.stdin.isTTY ? await readFromTty() : await readFromPipe();

  if (password.length < 12) {
    process.stderr.write("Refusing: use at least 12 characters.\n");
    process.exit(1);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256,
  );
  process.stdout.write(`pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
