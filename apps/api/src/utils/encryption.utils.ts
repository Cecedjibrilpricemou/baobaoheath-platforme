import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM field-level encryption for sensitive medical/PII columns.
// Encrypted values are tagged with PREFIX so decryptField can tell them
// apart from legacy plaintext rows written before this was introduced
// (those are returned as-is rather than crashing the request).
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | undefined;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const keyHex = process.env.DB_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('DB_ENCRYPTION_KEY is not set');
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('DB_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  cachedKey = key;
  return key;
}

export function encryptField(plaintext: string): string;
export function encryptField(plaintext: string | null | undefined): string | null | undefined;
export function encryptField(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptField(value: string): string;
export function decryptField(value: string | null | undefined): string | null | undefined;
export function decryptField(value: string | null | undefined): string | null | undefined {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString('utf8');
}

export function encryptArray(values: string[]): string[];
export function encryptArray(values: string[] | null | undefined): string[] | null | undefined;
export function encryptArray(values: string[] | null | undefined): string[] | null | undefined {
  return values?.map((v) => encryptField(v));
}

export function decryptArray(values: string[] | null | undefined): string[] | null | undefined {
  return values?.map((v) => decryptField(v));
}

const MAX_DEPTH = 8;

/**
 * Recursively decrypts any string in a Prisma result tree that carries the
 * encryption prefix. Self-identifying ciphertext means this can run as a
 * single global hook instead of needing a per-model/per-field map for every
 * level of `include`d relations.
 */
export function deepDecrypt<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > MAX_DEPTH) return value;

  if (typeof value === 'string') {
    return decryptField(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepDecrypt(item, depth + 1)) as unknown as T;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = deepDecrypt(record[key], depth + 1);
    }
    return value;
  }

  return value;
}
