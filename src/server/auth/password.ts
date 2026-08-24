import { hash, verify } from '@node-rs/argon2';

// argon2id with library defaults (sensible memory/time cost). Never store or log plaintext.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}
