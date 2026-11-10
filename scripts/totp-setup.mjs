// Generates an authenticator secret for the AppDrop admin and prints a QR code to scan.
// Usage: npm run totp:setup   → add the printed ADMIN_TOTP_SECRET to your environment.
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const buf = randomBytes(20);
let bits = 0, value = 0, secret = "";
for (const b of buf) {
  value = (value << 8) | b;
  bits += 8;
  while (bits >= 5) { secret += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
}
if (bits > 0) secret += B32[(value << (5 - bits)) & 31];

const label = encodeURIComponent(process.env.NEXT_PUBLIC_SITE_NAME || "AppDrop") + ":admin";
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(process.env.NEXT_PUBLIC_SITE_NAME || "AppDrop")}&algorithm=SHA1&digits=6&period=30`;

console.log("\nScan this with Google Authenticator, Authy, 1Password, Microsoft Authenticator, etc.:\n");
console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
console.log("Or enter this setup key manually:", secret.match(/.{1,4}/g).join(" "));
console.log("\nThen add to .env.local (and your production environment):\n");
console.log(`ADMIN_TOTP_SECRET=${secret}\n`);
console.log("Keep it secret. Anyone with it can generate your login codes.\n");
