import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { media } from "@/db/schema";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Detect image type from magic bytes — never trust the client-provided MIME. SVG is deliberately rejected. */
export function sniffImage(buf: Buffer): { mime: string; width?: number; height?: number } | null {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ...jpegSize(buf) };
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ...webpSize(buf) };
  }
  if (buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")) {
    return { mime: "image/gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  return null;
}

function jpegSize(buf: Buffer): { width?: number; height?: number } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return {};
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return {};
}

function webpSize(buf: Buffer): { width?: number; height?: number } {
  const fmt = buf.toString("ascii", 12, 16);
  if (fmt === "VP8X" && buf.length >= 30) return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (fmt === "VP8 " && buf.length >= 30) return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === "VP8L" && buf.length >= 25) {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  return {};
}

export async function storeImage(buf: Buffer): Promise<string> {
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) throw new Error("Image must be under 4 MB");
  const info = sniffImage(buf);
  if (!info) throw new Error("Unsupported image. Use PNG, JPEG, WebP or GIF.");
  const id = randomBytes(16).toString("base64url");
  await db.insert(media).values({ id, mime: info.mime, data: buf, width: info.width, height: info.height, bytes: buf.length });
  return id;
}

export async function storeImageFile(file: File): Promise<string> {
  return storeImage(Buffer.from(await file.arrayBuffer()));
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/media/${id}` : null);
