import { PrismaClient } from './generated/client/client';
import { encryptArray, encryptField, deepDecrypt } from '../utils/encryption.utils';

export interface FieldMap {
  scalar: string[];
  array: string[];
}

// Free-text medical/PII fields encrypted at rest. Deliberately excludes
// Diagnostic.libelle: it's grouped/filtered at the DB level for epidemic
// surveillance analytics (groupBy + contains), which non-deterministic
// AES-GCM ciphertext would break.
//
// Exported so prisma/backfill-encryption.ts can migrate existing plaintext
// rows using the exact same field list this extension encrypts going forward.
export const ENCRYPTED_FIELDS: Record<string, FieldMap> = {
  PatientProfile: { scalar: ['groupeSanguin', 'urgenceNom', 'urgenceTelephone'], array: ['allergies', 'maladiesChroniques'] },
  Consultation: { scalar: ['motifPrincipal', 'resumeIa', 'notesAsc', 'notesMedecin'], array: ['symptomes'] },
  Ordonnance: { scalar: ['posologie', 'instructions'], array: [] },
  Vaccination: { scalar: ['reaction'], array: [] },
  Message: { scalar: ['contenu'], array: [] },
};

function encryptDataObject(data: unknown, map: FieldMap): void {
  if (!data || typeof data !== 'object') return;
  const record = data as Record<string, unknown>;

  for (const field of map.scalar) {
    if (typeof record[field] === 'string') record[field] = encryptField(record[field] as string);
  }
  for (const field of map.array) {
    if (Array.isArray(record[field])) record[field] = encryptArray(record[field] as string[]);
  }
}

function encryptArgs(args: unknown, map: FieldMap): void {
  if (!args || typeof args !== 'object') return;
  const record = args as Record<string, unknown>;

  if (Array.isArray(record.data)) {
    record.data.forEach((item) => encryptDataObject(item, map));
  } else if (record.data) {
    encryptDataObject(record.data, map);
  }
  // upsert
  if (record.create) encryptDataObject(record.create, map);
  if (record.update) encryptDataObject(record.update, map);
}

export function withFieldEncryption<T extends PrismaClient>(client: T) {
  return client.$extends({
    name: 'field-encryption',
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const map = model ? ENCRYPTED_FIELDS[model] : undefined;
          if (map) encryptArgs(args, map);

          const result = await query(args);
          return deepDecrypt(result);
        },
      },
    },
  });
}
