/**
 * Password hashing with scrypt from node:crypto, so no native dependency.
 * Stored as "scrypt$N$r$p$salt$hash" (base64url), which keeps the cost
 * parameters with each hash and lets them be raised later without breaking
 * existing passwords.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
// scrypt needs 128 * N * r bytes; Node's default ceiling is 32 MiB.
const MAX_MEM = 64 * 1024 * 1024;

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Checked against when the username doesn't exist, so a wrong username takes
 * as long as a wrong password and response times don't reveal who has an
 * account.
 */
let decoy: Promise<string> | null = null;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  return decoy;
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Why a password is refused, or null if it's acceptable. */
export function passwordProblem(password: string, username: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return "That password is too long.";
  if (password.toLowerCase().includes(username)) return "Don’t put your username in your password.";
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|12345678|123456789|password\d*|qwerty\w*)$/i.test(password)) {
    return "That password is too easy to guess.";
  }
  return null;
}
