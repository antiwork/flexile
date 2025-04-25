import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import env from "@/env";

const ENCRYPTION_KEY = env.ENCRYPTION_KEY || "default-32-char-encryption-key-dev!";
const ALGORITHM = "aes-256-cbc";

if (!env.ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  throw new Error("ENCRYPTION_KEY environment variable is required in production");
}

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters long");
}

export const encrypt = async (text: string): Promise<string> => {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return IV + encrypted content in a single string
  return `${iv.toString("hex")}:${encrypted}`;
};

export const decrypt = async (encryptedText: string): Promise<string> => {
  try {
    const [ivHex, encryptedContent] = encryptedText.split(":");

    if (!ivHex || !encryptedContent) {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

    let decrypted = decipher.update(encryptedContent, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
