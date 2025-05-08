import crypto from "crypto";
import zlib from "zlib";
import { customType } from "drizzle-orm/pg-core";
import { z } from "zod";
import env from "@/env";

const encryptedDataSchema = z.object({
  h: z.object({ c: z.boolean().optional(), at: z.string(), iv: z.string() }),
  p: z.string(),
});
type EncryptedData = z.infer<typeof encryptedDataSchema>;

const algorithm = "aes-256-gcm";
const ivLength = 12;
const iterations = 2 ** 16;
const keySize = 32;
const deriveKey = (secret: string, salt: string): Buffer =>
  crypto.pbkdf2Sync(secret, salt, iterations, keySize, "sha256");
const primaryKey = deriveKey(
  env.ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY,
  env.ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT,
);
const deterministicKey = deriveKey(
  env.ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY,
  env.ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT,
);

const encrypt = (data: string, { deterministic }: { deterministic?: boolean } = {}): EncryptedData => {
  const key = deterministic ? deterministicKey : primaryKey;
  let iv;
  if (deterministic) {
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(data);
    iv = Buffer.from(hmac.digest().subarray(0, ivLength));
  } else {
    iv = Buffer.from(crypto.randomBytes(ivLength));
  }

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encrypted = cipher.update(data, "utf8", "base64") + cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return {
    h: {
      iv: iv.toString("base64"),
      at: authTag.toString("base64"),
    },
    p: encrypted,
  };
};

const decrypt = (
  { h: { iv, at, c: compressed }, p: encryptedData }: EncryptedData,
  { deterministic }: { deterministic?: boolean } = {},
) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    deterministic ? deterministicKey : primaryKey,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(at, "base64"));

  const decrypted =
    decipher.update(encryptedData, "base64", compressed ? "binary" : "utf8") +
    decipher.final(compressed ? "binary" : "utf8");

  if (compressed) {
    const decompressed = zlib.inflateSync(Buffer.from(decrypted, "binary"));
    return decompressed.toString();
  }

  return decrypted;
};

export const encryptedString = customType<{ data: string }>({
  dataType() {
    return "varchar";
  },
  toDriver(value) {
    return encrypt(value);
  },
  fromDriver(value: unknown) {
    if (typeof value !== "string") throw new Error("Expected string for encrypted string value");
    return decrypt(encryptedDataSchema.parse(JSON.parse(value)));
  },
});

export const deterministicEncryptedString = customType<{ data: string }>({
  dataType() {
    return "varchar";
  },
  toDriver(value) {
    return encrypt(value, { deterministic: true });
  },
  fromDriver(value: unknown) {
    if (typeof value !== "string") throw new Error("Expected string for encrypted string value");
    return decrypt(encryptedDataSchema.parse(JSON.parse(value)), { deterministic: true });
  },
});

export const encryptedJson = customType({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return encrypt(JSON.stringify(value));
  },
  fromDriver(value: unknown): unknown {
    return JSON.parse(decrypt(encryptedDataSchema.parse(value)));
  },
});
