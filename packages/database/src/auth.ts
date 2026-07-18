import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: MAX_MEMORY },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return fakePasswordCheck(password);

  try {
    const [, cost, blockSize, parallelization, encodedSalt, encodedKey] = parts;
    if (Number(cost) !== COST || Number(blockSize) !== BLOCK_SIZE || Number(parallelization) !== PARALLELIZATION) {
      return fakePasswordCheck(password);
    }
    const expected = Buffer.from(encodedKey, "base64url");
    if (expected.length !== KEY_LENGTH) return fakePasswordCheck(password);
    const actual = await scrypt(password, Buffer.from(encodedSalt, "base64url"));
    return timingSafeEqual(actual, expected);
  } catch {
    return fakePasswordCheck(password);
  }
}

export async function fakePasswordCheck(password: string): Promise<false> {
  const actual = await scrypt(password, Buffer.alloc(16));
  timingSafeEqual(actual, Buffer.alloc(KEY_LENGTH));
  return false;
}
