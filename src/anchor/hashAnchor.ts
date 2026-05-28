import { createHash } from "node:crypto";

export function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/^\s+|\s+$/g, "");
}

export function blockHash(text: string): string {
  return createHash("sha256").update(normalizeBlock(text)).digest("hex");
}
